from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.project import Project, Task
from datetime import datetime

projects_bp = Blueprint('projects', __name__)

def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id))

@projects_bp.route('/', methods=['GET'])
@jwt_required()
def get_projects():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    projects = Project.query.filter_by(tenant_id=user.tenant_id, is_deleted=False).all()
    return jsonify({
        "data": [p.to_dict() for p in projects],
        "meta": {"count": len(projects)},
        "errors": None
    }), 200

@projects_bp.route('/', methods=['POST'])
@jwt_required()
def create_project():
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({"data": None, "meta": None, "errors": ["Project name is required"]}), 400
        
    project = Project(
        tenant_id=user.tenant_id,
        company_id=user.company_id,
        name=data.get('name'),
        description=data.get('description'),
        priority=data.get('priority', 'Medium'),
        status='Planned',
        budget=float(data.get('budget', 0.00))
    )
    
    db.session.add(project)
    db.session.commit()
    return jsonify({"data": project.to_dict(), "meta": None, "errors": None}), 201

@projects_bp.route('/<int:project_id>/tasks', methods=['GET'])
@jwt_required()
def get_project_tasks(project_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    tasks = Task.query.filter_by(tenant_id=user.tenant_id, project_id=project_id, is_deleted=False).all()
    return jsonify({
        "data": [t.to_dict() for t in tasks],
        "meta": {"count": len(tasks)},
        "errors": None
    }), 200

@projects_bp.route('/<int:project_id>/tasks', methods=['POST'])
@jwt_required()
def create_project_task(project_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    if not data.get('title'):
        return jsonify({"data": None, "meta": None, "errors": ["Task title is required"]}), 400
        
    task = Task(
        tenant_id=user.tenant_id,
        project_id=project_id,
        title=data.get('title'),
        description=data.get('description'),
        status=data.get('status', 'Todo'),
        priority=data.get('priority', 'Medium')
    )
    
    db.session.add(task)
    db.session.commit()
    return jsonify({"data": task.to_dict(), "meta": None, "errors": None}), 201

@projects_bp.route('/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task_status(task_id):
    user = get_current_user()
    if not user:
        return jsonify({"data": None, "meta": None, "errors": ["User not found"]}), 404
        
    data = request.get_json() or {}
    task = Task.query.filter_by(id=task_id, tenant_id=user.tenant_id).first()
    if not task:
        return jsonify({"data": None, "meta": None, "errors": ["Task not found"]}), 404
        
    if 'status' in data:
        task.status = data['status']
    if 'priority' in data:
        task.priority = data['priority']
        
    db.session.commit()
    return jsonify({"data": task.to_dict(), "meta": None, "errors": None}), 200
