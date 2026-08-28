"""
Branch-Scoped Data Filtering Middleware
Automatically filters queries by branch_id when user has selected a branch.
"""
from functools import wraps
from flask import request, g
from flask_jwt_extended import get_jwt, get_jwt_identity
from app.extensions import db
from app.models.user import User


def get_branch_from_token():
    """
    Extract branch_id from JWT token claims.
    Returns None if no branch is selected.
    """
    try:
        claims = get_jwt()
        return claims.get('branch_id')
    except:
        return None


def get_current_user():
    """Get current user from JWT identity"""
    try:
        user_id = get_jwt_identity()
        return db.session.get(User, int(user_id))
    except:
        return None


def require_branch_filter(f):
    """
    Decorator that injects branch filter into the request context.
    
    Usage:
        @reports_bp.route('/sales/daily')
        @jwt_required()
        @require_branch_filter
        def daily_sales():
            branch_id = g.branch_filter  # Access the branch filter
            # Apply to queries as needed
    
    The decorator:
    1. Extracts branch_id from JWT claims
    2. Stores it in Flask's g object for access in the route handler
    3. Does NOT automatically filter - routes must manually apply the filter
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get branch from JWT token
        branch_id = get_branch_from_token()
        
        # Store in Flask's g object for access in route handlers
        g.branch_filter = branch_id
        g.branch_filter_active = branch_id is not None
        
        return f(*args, **kwargs)
    
    return decorated


def apply_branch_filter(query, model, branch_field='branch_id'):
    """
    Helper function to apply branch filter to a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy query object
        model: Model class being queried
        branch_field: Name of the branch foreign key field (default: 'branch_id')
    
    Returns:
        Filtered query if branch_filter is active, otherwise original query
    
    Usage:
        query = Customer.query.filter_by(tenant_id=user.tenant_id)
        query = apply_branch_filter(query, Customer)
        customers = query.all()
    """
    if hasattr(g, 'branch_filter') and g.branch_filter:
        # Check if model has the branch field
        if hasattr(model, branch_field):
            query = query.filter(getattr(model, branch_field) == g.branch_filter)
    
    return query


def get_branch_filter_dict(branch_field='branch_id'):
    """
    Get branch filter as a dictionary for use in filter_by().
    
    Returns:
        Dictionary with branch filter if active, empty dict otherwise
    
    Usage:
        filters = {'tenant_id': user.tenant_id, **get_branch_filter_dict()}
        customers = Customer.query.filter_by(**filters).all()
    """
    if hasattr(g, 'branch_filter') and g.branch_filter:
        return {branch_field: g.branch_filter}
    return {}


# Optional: Auto-filtering decorator for common CRUD patterns
def auto_filter_branch(model_class, branch_field='branch_id'):
    """
    Decorator that automatically applies branch filtering to route handlers
    that return lists of records.
    
    This is an optional convenience decorator for simple list routes.
    For complex queries, use require_branch_filter + apply_branch_filter manually.
    
    Usage:
        @customers_bp.route('')
        @jwt_required()
        @auto_filter_branch(Customer)
        def list_customers():
            # Query automatically includes branch filter
            customers = Customer.query.filter_by(tenant_id=current_user.tenant_id).all()
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Set up branch filter
            branch_id = get_branch_from_token()
            g.branch_filter = branch_id
            g.branch_filter_active = branch_id is not None
            
            # Call the original function
            return f(*args, **kwargs)
        
        return decorated
    return decorator
