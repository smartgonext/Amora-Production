from datetime import datetime
from app.extensions import db, bcrypt
from app.models.base import BaseModel


class Role(BaseModel):
    __tablename__ = 'roles'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    is_system_role = db.Column(db.Boolean, default=False)  # Cannot be deleted
    
    users = db.relationship('User', backref='role', lazy='dynamic')
    permissions = db.relationship('Permission', secondary='role_permissions', backref=db.backref('roles', lazy='dynamic'))


class Permission(BaseModel):
    __tablename__ = 'permissions'
    
    name = db.Column(db.String(100), unique=True, nullable=False)
    module = db.Column(db.String(50), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # CREATE, READ, UPDATE, DELETE, EXPORT, PRINT
    description = db.Column(db.String(255), nullable=True)


class RolePermission(db.Model):
    __tablename__ = 'role_permissions'
    
    role_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('roles.id'), primary_key=True)
    permission_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('permissions.id'), primary_key=True)


class User(BaseModel):
    __tablename__ = 'users'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    branch_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('branches.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('roles.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_superadmin = db.Column(db.Boolean, default=False)
    profile_image = db.Column(db.String(255), nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    two_factor_enabled = db.Column(db.Boolean, default=False)
    two_factor_secret = db.Column(db.String(100), nullable=True)
    preferred_language = db.Column(db.String(10), default='en')
    theme_preference = db.Column(db.String(10), default='light')  # light, dark
    
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    login_history = db.relationship('LoginHistory', backref='user', lazy='dynamic', cascade="all, delete-orphan")
    sessions = db.relationship('UserSession', backref='user', lazy='dynamic', cascade="all, delete-orphan")


class UserSession(BaseModel):
    """Track active user sessions for session management"""
    __tablename__ = 'user_sessions'
    
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=False, index=True)
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)  # JWT ID
    refresh_token = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    device_fingerprint = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    last_activity_at = db.Column(db.DateTime, nullable=True)


class LoginHistory(BaseModel):
    __tablename__ = 'login_history'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=True, index=True)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=False, index=True)
    ip_address = db.Column(db.String(45), nullable=True)
    device_fingerprint = db.Column(db.String(255), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    location_city = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), default='success')  # success, failed
    failure_reason = db.Column(db.String(100), nullable=True)