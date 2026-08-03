from app.extensions import db
from app.models.base import BaseModel


class Document(BaseModel):
    __tablename__ = 'documents'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    company_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('companies.id'), nullable=True)
    folder = db.Column(db.String(50), default='General')  # Contracts, Agreements, Invoices, Reports, Other
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_name = db.Column(db.String(200), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20), nullable=True)  # pdf, docx, xlsx, image
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    uploaded_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    is_public = db.Column(db.Boolean, default=False)
    
    versions = db.relationship('DocumentVersion', backref='document', lazy='dynamic', cascade="all, delete-orphan")
    tags = db.relationship('DocumentTag', backref='document', lazy='dynamic', cascade="all, delete-orphan")


class DocumentVersion(BaseModel):
    __tablename__ = 'document_versions'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    document_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('documents.id'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    file_name = db.Column(db.String(200), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    uploaded_by = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('users.id'), nullable=True)
    change_notes = db.Column(db.Text, nullable=True)


class DocumentTag(BaseModel):
    __tablename__ = 'document_tags'
    
    tenant_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('tenants.id'), nullable=False, index=True)
    document_id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), db.ForeignKey('documents.id'), nullable=False)
    tag = db.Column(db.String(30), nullable=False)