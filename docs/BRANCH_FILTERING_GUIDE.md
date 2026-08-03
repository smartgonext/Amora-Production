# Branch-Scoped Data Filtering Guide

## Overview

The branch filtering middleware allows users to filter data by branch when working in a multi-branch setup. When a user selects a branch from the sidebar dropdown, all subsequent API requests automatically filter data to show only records from that branch.

## Architecture

### Backend Components

1. **Middleware**: `backend/app/middleware/branch_filter.py`
   - Provides decorators and helper functions for branch filtering
   - Extracts `branch_id` from JWT token claims
   - Stores branch filter in Flask's `g` object

2. **Auth Endpoint**: `/api/v1/auth/select-branch` (POST)
   - Updates JWT token with selected `branch_id`
   - Validates branch belongs to user's tenant
   - Returns new access token with branch in claims

3. **JWT Token Claims Structure**:
```json
{
  "sub": "user_id",
  "tenant_id": 1,
  "company_id": 1,
  "role": "Admin",
  "branch_id": 5  // Optional: only present when branch is selected
}
```

### Frontend Components

1. **CompanyContext**: `frontend/src/context/CompanyContext.jsx`
   - Manages selected branch state
   - Calls `/auth/select-branch` endpoint
   - Updates access token in localStorage and apiClient headers

2. **Sidebar Branch Selector**: `frontend/src/components/layout/Sidebar.jsx`
   - Dropdown to select branch
   - Shows "All Branches" when no branch selected
   - Persists selection to localStorage

## Usage

### Backend Usage

#### Method 1: Using Decorators (Recommended for Simple Cases)

```python
from flask import Blueprint, jsonify, g
from flask_jwt_extended import jwt_required
from app.middleware.branch_filter import require_branch_filter, apply_branch_filter
from app.models.customer import Customer

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('', methods=['GET'])
@jwt_required()
@require_branch_filter  # Add this decorator
def get_customers():
    user = get_current_user()
    
    # Build base query
    query = Customer.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    # Apply branch filter
    query = apply_branch_filter(query, Customer)
    
    customers = query.all()
    
    return jsonify({
        "data": [c.to_dict() for c in customers],
        "meta": {
            "count": len(customers),
            "branch_filter_active": g.branch_filter_active,
            "branch_id": g.branch_filter
        }
    }), 200
```

#### Method 2: Using Helper Dictionary (For filter_by)

```python
from app.middleware.branch_filter import require_branch_filter, get_branch_filter_dict

@products_bp.route('', methods=['GET'])
@jwt_required()
@require_branch_filter
def get_products():
    user = get_current_user()
    
    # Build filters including branch
    filters = {
        'tenant_id': user.tenant_id,
        'is_deleted': False,
        **get_branch_filter_dict()  # Adds branch_id if active
    }
    
    products = Product.query.filter_by(**filters).all()
    
    return jsonify({"data": [p.to_dict() for p in products]}), 200
```

#### Method 3: Manual Check (For Complex Queries)

```python
from flask import g
from app.middleware.branch_filter import require_branch_filter

@sales_bp.route('/report', methods=['GET'])
@jwt_required()
@require_branch_filter
def sales_report():
    user = get_current_user()
    
    query = db.session.query(Invoice).filter_by(tenant_id=user.tenant_id)
    
    # Manually check branch filter
    if hasattr(g, 'branch_filter') and g.branch_filter:
        query = query.filter(Invoice.branch_id == g.branch_filter)
    
    # Continue with complex aggregations...
    result = query.group_by(...).all()
    
    return jsonify({"data": result}), 200
```

### Frontend Usage

#### Selecting a Branch

```javascript
import { useCompany } from '../../context/CompanyContext';

function MyComponent() {
  const { branches, selectedBranch, selectBranch } = useCompany();
  
  const handleBranchChange = async (branchId) => {
    try {
      await selectBranch(branchId);  // Calls API and updates token
      // Data will now be filtered by this branch
      // Trigger data refresh here if needed
      refetch();
    } catch (error) {
      toast.error('Failed to select branch');
    }
  };
  
  return (
    <select value={selectedBranch || ''} onChange={(e) => handleBranchChange(e.target.value ? parseInt(e.target.value) : null)}>
      <option value="">All Branches</option>
      {branches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}
```

#### Displaying Branch Filter Status

```javascript
function CustomersList() {
  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get('/customers');
      return response.data;
    }
  });
  
  return (
    <div>
      {data?.meta?.branch_filter_active && (
        <div className="alert alert-info">
          Showing data for selected branch only
        </div>
      )}
      
      <table>
        {/* Customer rows */}
      </table>
    </div>
  );
}
```

## Database Schema Requirements

For a model to support branch filtering, it must have a `branch_id` foreign key column:

```python
class Customer(BaseModel):
    __tablename__ = 'customers'
    
    id = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(db.BigInteger, db.ForeignKey('tenants.id'), nullable=False)
    company_id = db.Column(db.BigInteger, db.ForeignKey('companies.id'), nullable=False)
    branch_id = db.Column(db.BigInteger, db.ForeignKey('branches.id'), nullable=True)  # Required
    
    # ... other fields
```

**Note**: `branch_id` can be nullable to support:
- Companies that don't use branches yet
- Records created before branches were set up
- Global/company-level records

## Applying to Existing Routes

To add branch filtering to an existing route:

1. **Add the decorator**: Add `@require_branch_filter` after `@jwt_required()`
2. **Import helpers**: `from app.middleware.branch_filter import require_branch_filter, apply_branch_filter`
3. **Apply filter**: Call `apply_branch_filter(query, ModelClass)` on your query
4. **Add Flask g import**: `from flask import g`
5. **Return filter status**: Add `branch_filter_active` and `branch_id` to response meta

Example conversion:

**Before:**
```python
@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    user = get_current_user()
    customers = Customer.query.filter_by(tenant_id=user.tenant_id).all()
    return jsonify({"data": [c.to_dict() for c in customers]}), 200
```

**After:**
```python
from flask import g
from app.middleware.branch_filter import require_branch_filter, apply_branch_filter

@customers_bp.route('', methods=['GET'])
@jwt_required()
@require_branch_filter
def get_customers():
    user = get_current_user()
    query = Customer.query.filter_by(tenant_id=user.tenant_id)
    query = apply_branch_filter(query, Customer)
    customers = query.all()
    return jsonify({
        "data": [c.to_dict() for c in customers],
        "meta": {
            "branch_filter_active": g.branch_filter_active,
            "branch_id": g.branch_filter
        }
    }), 200
```

## Routes That Should Have Branch Filtering

Apply branch filtering to these modules:

- ✅ **Customers** - `backend/app/routes/customers.py` (DONE)
- ⬜ **Suppliers** - `backend/app/routes/suppliers.py`
- ⬜ **Products** - `backend/app/routes/products.py`
- ⬜ **Sales/Invoices** - `backend/app/routes/sales.py`
- ⬜ **Purchases** - `backend/app/routes/purchase.py`
- ⬜ **Inventory** - `backend/app/routes/inventory.py`
- ⬜ **Finance** - `backend/app/routes/finance.py`
- ⬜ **HR/Employees** - `backend/app/routes/hr.py`

## Routes That Should NOT Have Branch Filtering

These routes operate at tenant or company level:

- **Branches Management** - `/branches` (manages branches themselves)
- **Users Management** - `/users` (users can access multiple branches)
- **Company Settings** - `/companies` (company-level config)
- **Subscriptions** - `/subscriptions` (tenant-level)
- **Reports** - Some reports aggregate across all branches

## Testing

### Test Branch Selection

```bash
# 1. Login to get token
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# 2. Select a branch (updates token)
curl -X POST http://localhost:5000/api/v1/auth/select-branch \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id": 1}'

# 3. Fetch customers (should only show branch 1 customers)
curl -X GET http://localhost:5000/api/v1/customers \
  -H "Authorization: Bearer NEW_ACCESS_TOKEN_FROM_STEP_2"

# 4. Clear branch selection (show all branches)
curl -X POST http://localhost:5000/api/v1/auth/select-branch \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_id": null}'
```

### Test Response Format

Successful branch filtering response should include:

```json
{
  "data": [...],
  "meta": {
    "count": 10,
    "branch_filter_active": true,
    "branch_id": 1
  },
  "errors": null
}
```

## Troubleshooting

### Branch Filter Not Working

1. **Check decorator order**: `@require_branch_filter` must come AFTER `@jwt_required()`
2. **Verify token**: Use jwt.io to decode token and check `branch_id` claim exists
3. **Check model**: Ensure model has `branch_id` column
4. **Check filter application**: Verify `apply_branch_filter()` is called on the query

### Branch Selection Fails

1. **Branch not found**: Ensure branch exists and belongs to user's tenant
2. **Branch is deleted**: Check `is_deleted=False` in query
3. **Permission issue**: Verify user has access to that branch

### Frontend Token Not Updating

1. **Check localStorage**: Verify new token is saved
2. **Check apiClient headers**: Ensure Authorization header is updated
3. **Check interceptor**: Verify auth interceptor is properly configured

## Security Considerations

1. **Branch Validation**: Backend ALWAYS validates branch belongs to user's tenant
2. **Token Security**: Branch selection generates a new JWT, old token is invalidated
3. **No Client Trust**: Backend never trusts `branch_id` from request body, only from JWT claims
4. **Audit Trail**: All branch-filtered queries should be auditable

## Performance

- **No Extra Queries**: Branch filtering uses existing indexes on `branch_id` column
- **Cached in Token**: Branch selection is cached in JWT, no DB lookup per request
- **Index Required**: Ensure `branch_id` column is indexed: `CREATE INDEX idx_customers_branch ON customers(branch_id);`

## Future Enhancements

- [ ] Add branch-level permissions (user can only access specific branches)
- [ ] Add branch transfer functionality (move records between branches)
- [ ] Add branch comparison reports (compare metrics across branches)
- [ ] Add branch-level dashboards
