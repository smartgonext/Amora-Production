from app.extensions import db
from app.models.base import BaseModel


class Project(BaseModel):
    __tablename__ = 'projects'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='Planned', index=True)  # Planned, InProgress, OnHold, Completed, Cancelled
    priority = db.Column(db.String(10), default='Medium')  # Low, Medium, High, Critical
    budget = db.Column(db.Numeric(12, 2), default=0.00)
    customer_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('customers.id'), nullable=True)
    assigned_to = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    
    tasks = db.relationship('Task', backref='project', lazy='dynamic', cascade="all, delete-orphan")


class Task(BaseModel):
    __tablename__ = 'tasks'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    project_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('projects.id'), nullable=True)
    parent_task_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='Todo', index=True)  # Todo, InProgress, Review, Done, Cancelled
    priority = db.Column(db.String(10), default='Medium')
    assigned_to = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    estimated_hours = db.Column(db.Numeric(6, 2), nullable=True)
    actual_hours = db.Column(db.Numeric(6, 2), nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    
    comments = db.relationship('TaskComment', backref='task', lazy='dynamic', cascade="all, delete-orphan")
    attachments = db.relationship('TaskAttachment', backref='task', lazy='dynamic', cascade="all, delete-orphan")


class TaskComment(BaseModel):
    __tablename__ = 'task_comments'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    task_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=False)
    comment = db.Column(db.Text, nullable=False)


class TaskAttachment(BaseModel):
    __tablename__ = 'task_attachments'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    task_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tasks.id'), nullable=False)
    file_name = db.Column(db.String(100), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    uploaded_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=False)


class KanbanBoard(BaseModel):
    __tablename__ = 'kanban_boards'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    project_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('projects.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    
    columns = db.relationship('KanbanColumn', backref='board', lazy='dynamic', cascade="all, delete-orphan")


class KanbanColumn(BaseModel):
    __tablename__ = 'kanban_columns'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    board_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('kanban_boards.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    color = db.Column(db.String(20), nullable=True)
    
    cards = db.relationship('KanbanCard', backref='column', lazy='dynamic', cascade="all, delete-orphan")


class KanbanCard(BaseModel):
    __tablename__ = 'kanban_cards'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    column_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('kanban_columns.id'), nullable=False)
    task_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tasks.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0)