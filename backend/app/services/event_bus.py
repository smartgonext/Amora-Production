"""Internal Event Bus - pub-sub system for rule-based automations

All automations subscribe to events like 'invoice.created', 'stock.low', etc.
This ensures request handlers stay fast and automation logic is testable in isolation.
"""
from datetime import datetime, timedelta
from app.extensions import db
from app.models.audit import EventLog, Notification
from app.models.tenant import NumberSeries


class EventBus:
    """Lightweight internal pub-sub event system"""

    _listeners = {}

    @classmethod
    def on(cls, event_name):
        """Decorator to register a listener for an event"""
        def decorator(func):
            if event_name not in cls._listeners:
                cls._listeners[event_name] = []
            cls._listeners[event_name].append(func)
            return func
        return decorator

    @classmethod
    def emit(cls, event_name, tenant_id=None, entity_type=None, entity_id=None, payload=None):
        """Fire an event and trigger all registered listeners"""
        # Log the event
        event = EventLog(
            tenant_id=tenant_id,
            event_name=event_name,
            entity_type=entity_type,
            entity_id=entity_id,
            payload_json=payload,
            fired_at=datetime.utcnow()
        )
        db.session.add(event)
        db.session.commit()

        # Trigger synchronous listeners
        listeners = cls._listeners.get(event_name, [])
        results = []
        for listener in listeners:
            try:
                result = listener(tenant_id=tenant_id, entity_id=entity_id, payload=payload)
                results.append(result)
            except Exception as e:
                print(f"[EventBus] Error in listener {listener.__name__} for {event_name}: {e}")

        # Mark event as processed
        event.processed = True
        db.session.commit()

        return results


# ============================================================
# AUTOMATIONS - Listeners registered on the EventBus
# ============================================================

@EventBus.on('invoice.created')
def handle_invoice_created(tenant_id=None, entity_id=None, payload=None):
    """Automation: Auto-number invoice, calculate GST, update ledger"""
    from app.models.sales import Invoice, InvoiceItem
    from app.models.customer import CustomerLedger

    invoice = db.session.get(Invoice, entity_id)
    if not invoice:
        return {'status': 'error', 'message': 'Invoice not found'}

    # 1. Update customer purchase stats
    from app.models.customer import Customer
    customer = db.session.get(Customer, invoice.customer_id)
    if customer:
        customer.total_purchases = (customer.total_purchases or 0) + invoice.net_amount
        customer.purchase_count = (customer.purchase_count or 0) + 1
        customer.last_purchase_date = datetime.utcnow()
        db.session.add(customer)

    # 2. Create customer ledger entry (debit)
    ledger = CustomerLedger(
        tenant_id=tenant_id,
        customer_id=invoice.customer_id,
        transaction_date=invoice.invoice_date or datetime.utcnow(),
        type='Debit',
        amount=invoice.net_amount,
        reference_type='invoice',
        reference_id=invoice.id,
        description=f"Invoice {invoice.invoice_number}",
        running_balance=0  # Will be calculated
    )
    db.session.add(ledger)

    # 3. Update stock for product items
    from app.models.product import StockLedger
    for item in invoice.items.all():
        if item.product_id:
            stock_entry = StockLedger(
                tenant_id=tenant_id,
                product_id=item.product_id,
                quantity_delta=-item.quantity,
                running_balance=0,
                type='Sale',
                reference_type='invoice',
                reference_id=invoice.id,
                rate=item.rate,
                transaction_date=datetime.utcnow()
            )
            db.session.add(stock_entry)

            # Update product stock
            from app.models.product import Product
            product = db.session.get(Product, item.product_id)
            if product:
                product.current_stock = max(0, (product.current_stock or 0) - item.quantity)
                db.session.add(product)

    db.session.commit()

    # 4. Check low stock and emit event if needed
    for item in invoice.items.all():
        if item.product_id:
            from app.models.product import Product
            product = db.session.get(Product, item.product_id)
            if product and product.current_stock <= product.min_stock_level:
                EventBus.emit(
                    'stock.low',
                    tenant_id=tenant_id,
                    entity_type='product',
                    entity_id=product.id,
                    payload={'product_name': product.name, 'current_stock': product.current_stock, 'min_level': product.min_stock_level}
                )

    return {'status': 'ok', 'invoice_id': invoice.id, 'ledger_created': True}


@EventBus.on('invoice.paid')
def handle_invoice_paid(tenant_id=None, entity_id=None, payload=None):
    """Automation: Update invoice status when paid"""
    from app.models.sales import Invoice, Receipt, ReceiptAllocation

    receipt = db.session.get(Receipt, entity_id)
    if not receipt:
        return {'status': 'error'}

    # Update allocations and invoice payment status
    for alloc in receipt.allocations.all():
        invoice = db.session.get(Invoice, alloc.invoice_id)
        if invoice:
            invoice.outstanding_balance = max(0, (invoice.outstanding_balance or invoice.net_amount) - alloc.amount)
            if invoice.outstanding_balance <= 0:
                invoice.payment_status = 'Paid'
            else:
                invoice.payment_status = 'Partial'
            db.session.add(invoice)

    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('stock.low')
def handle_stock_low(tenant_id=None, entity_id=None, payload=None):
    """Automation: Create notification for low stock"""
    product_name = payload.get('product_name', 'Unknown') if payload else 'Unknown'
    current_stock = payload.get('current_stock', 0) if payload else 0

    notification = Notification(
        tenant_id=tenant_id,
        type='LowStock',
        title=f'Low Stock Alert: {product_name}',
        message=f'Stock level for {product_name} is {current_stock}. Reorder soon.',
        reference_type='product',
        reference_id=entity_id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok', 'notification_created': True}


@EventBus.on('payment.overdue')
def handle_payment_overdue(tenant_id=None, entity_id=None, payload=None):
    """Automation: Notify about overdue payments"""
    from app.models.sales import Invoice
    invoice = db.session.get(Invoice, entity_id)
    if not invoice:
        return {'status': 'error'}

    from app.models.customer import Customer
    customer = db.session.get(Customer, invoice.customer_id)
    customer_name = customer.name if customer else 'Unknown'

    notification = Notification(
        tenant_id=tenant_id,
        type='PaymentDue',
        title=f'Payment Overdue: {invoice.invoice_number}',
        message=f'Invoice {invoice.invoice_number} for {customer_name} is overdue. Amount: ₹{invoice.outstanding_balance}',
        reference_type='invoice',
        reference_id=invoice.id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('customer.birthday')
def handle_customer_birthday(tenant_id=None, entity_id=None, payload=None):
    """Automation: Send birthday wishes"""
    from app.models.customer import Customer
    customer = db.session.get(Customer, entity_id)
    if not customer:
        return {'status': 'error'}

    notification = Notification(
        tenant_id=tenant_id,
        type='Birthday',
        title=f'Birthday: {customer.name}',
        message=f'Today is {customer.name}\'s birthday! Send your best wishes.',
        reference_type='customer',
        reference_id=customer.id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('subscription.expiring')
def handle_subscription_expiring(tenant_id=None, entity_id=None, payload=None):
    """Automation: Notify about expiring subscription"""
    days_left = payload.get('days_left', 0) if payload else 0
    notification = Notification(
        tenant_id=tenant_id,
        type='SubscriptionExpiry',
        title=f'Subscription Expiring in {days_left} days',
        message=f'Your subscription will expire in {days_left} days. Renew to avoid service interruption.',
        reference_type='subscription',
        reference_id=entity_id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('rental.return_due_soon')
def handle_rental_return_due(tenant_id=None, entity_id=None, payload=None):
    """Automation: Notify about upcoming rental return"""
    from app.models.equipment import RentalBooking
    booking = db.session.get(RentalBooking, entity_id)
    if not booking:
        return {'status': 'error'}

    from app.models.customer import Customer
    customer = db.session.get(Customer, booking.customer_id)

    notification = Notification(
        tenant_id=tenant_id,
        type='RentalReturn',
        title=f'Rental Return Due: {booking.booking_number}',
        message=f'Rental booking {booking.booking_number} for {customer.name if customer else "Customer"} is due on {booking.end_date.strftime("%d-%b-%Y") if booking.end_date else "N/A"}.',
        reference_type='rental_booking',
        reference_id=booking.id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('amc.contract_expiring')
def handle_amc_expiring(tenant_id=None, entity_id=None, payload=None):
    """Automation: Notify about AMC contract expiry"""
    from app.models.amc import AMCContract
    contract = db.session.get(AMCContract, entity_id)
    if not contract:
        return {'status': 'error'}

    notification = Notification(
        tenant_id=tenant_id,
        type='AMCService',
        title=f'AMC Contract Expiring: {contract.contract_title}',
        message=f'AMC contract "{contract.contract_title}" is expiring soon. Renew to continue coverage.',
        reference_type='amc_contract',
        reference_id=contract.id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}


@EventBus.on('amc.service_visit_due')
def handle_amc_service_due(tenant_id=None, entity_id=None, payload=None):
    """Automation: Notify about scheduled AMC service"""
    from app.models.amc import AMCServiceSchedule
    visit = db.session.get(AMCServiceSchedule, entity_id)
    if not visit:
        return {'status': 'error'}

    from app.models.amc import AMCContract
    contract = db.session.get(AMCContract, visit.amc_id)

    notification = Notification(
        tenant_id=tenant_id,
        type='AMCService',
        title=f'Service Visit Due: {contract.contract_title if contract else "AMC"}',
        message=f'Scheduled service visit is due on {visit.scheduled_date.strftime("%d-%b-%Y") if visit.scheduled_date else "N/A"}.',
        reference_type='amc_service',
        reference_id=visit.id
    )
    db.session.add(notification)
    db.session.commit()
    return {'status': 'ok'}