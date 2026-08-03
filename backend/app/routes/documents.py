from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.document import Document
from datetime import datetime

documents_bp = Blueprint('documents', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@documents_bp.route('/', methods=['GET'])
@jwt_required()
def get_documents():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    query = Document.query.filter_by(tenant_id=user.tenant_id, is_deleted=False)
    
    folder = request.args.get('folder')
    if folder:
        query = query.filter_by(folder=folder)
        
    docs = query.all()
    return jsonify({
        "data": [d.to_dict() for d in docs],
        "meta": {"count": len(docs)},
        "errors": None
    }), 200

@documents_bp.route('/', methods=['POST'])
@jwt_required()
def upload_document():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('title'):
        return jsonify({"data": None, "meta": None, "errors": ["Document title is required"]}), 400
        
    doc = Document(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        title=data.get('title'),
        description=data.get('description'),
        folder=data.get('folder', 'General'),
        file_name=data.get('file_name', 'document.pdf'),
        file_url=data.get('file_url', '/uploads/document.pdf'),
        file_type=data.get('file_type', 'pdf'),
        file_size=int(data.get('file_size', 1024)),
        uploaded_by=user.id
    )
    
    db.session.add(doc)
    db.session.commit()
    return jsonify({"data": doc.to_dict(), "meta": None, "errors": None}), 201

@documents_bp.route('/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    doc = Document.query.filter_by(id=doc_id, tenant_id=user.tenant_id).first()
    if not doc:
        return jsonify({"data": None, "meta": None, "errors": ["Document not found"]}), 404
        
    doc.is_deleted = True
    db.session.commit()
    return jsonify({"data": {"id": doc_id}, "meta": None, "errors": None}), 200
