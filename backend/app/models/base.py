from datetime import datetime
from app.extensions import db

class BaseModel(db.Model):
    __abstract__ = True
    
    id = db.Column(db.BigInteger().with_variant(db.Integer, "mysql"), primary_key=True, autoincrement=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)

    def soft_delete(self):
        """Soft delete the record"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
        db.session.add(self)
        db.session.commit()

    def restore(self):
        """Restore a soft-deleted record"""
        self.is_deleted = False
        self.deleted_at = None
        db.session.add(self)
        db.session.commit()

    def save(self):
        """Save the record to database"""
        db.session.add(self)
        db.session.commit()
        return self

    def to_dict(self):
        """Helper method to serialize SQLAlchemy model fields"""
        data = {}
        from decimal import Decimal
        from datetime import datetime, date
        for column in self.__table__.columns:
            val = getattr(self, column.name)
            if isinstance(val, (datetime, date)):
                data[column.name] = val.isoformat()
            elif isinstance(val, Decimal):
                data[column.name] = float(val)
            else:
                data[column.name] = val
        return data