from flask import Blueprint, request, jsonify
from database import Database, User, Bookmark, SearchHistory
from functools import wraps
import os
import jwt
from datetime import datetime, timedelta
import json

auth_bp = Blueprint('auth', __name__)
db = Database()

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'doggystyle')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION = timedelta(days=1)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload['user_id']
            
            # Verify user still exists
            db_session = db.Session()
            try:
                user = db_session.query(User).filter_by(id=user_id).first()
                if not user:
                    return jsonify({'error': 'User not found'}), 401
            finally:
                db_session.close()
                
            return f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
    return decorated_function

@auth_bp.route('/check', methods=['GET'])
def check_auth():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload['user_id']
        
        db_session = db.Session()
        try:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            return jsonify({
                'id': user.id,
                'username': user.username
            })
        finally:
            db_session.close()
    except jwt.ExpiredSignatureError:
        return jsonify({'error': 'Token has expired'}), 401
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    db_session = db.Session()
    try:
        # Check if username exists
        existing_user = db_session.query(User).filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'Username already exists'}), 409
        
        # Create new user
        user = User(username=username)
        user.set_password(password)
        db_session.add(user)
        db_session.commit()
        
        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + JWT_EXPIRATION
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return jsonify({
            'message': 'User created successfully',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username
            }
        }), 201
    finally:
        db_session.close()

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    db_session = db.Session()
    try:
        user = db_session.query(User).filter_by(username=username).first()
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Generate JWT token
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + JWT_EXPIRATION
        }, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username
            }
        })
    finally:
        db_session.close()

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    # Since JWT is stateless, we don't need to do anything on the server side
    return jsonify({'message': 'Logged out successfully'})

@auth_bp.route('/bookmarks', methods=['GET'])
@login_required
def get_bookmarks():
    token = request.headers.get('Authorization')
    if token.startswith('Bearer '):
        token = token[7:]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id = payload['user_id']
    
    bookmarks = db.get_user_bookmarks(user_id)
    return jsonify([{
        'id': b.id,
        'book_id': b.book_id,
        'title': b.title,
        'note': b.note,
        'character_data': b.character_data,
        'validation_data': b.validation_data,
        'created_at': b.created_at.isoformat()
    } for b in bookmarks])

@auth_bp.route('/bookmarks', methods=['POST'])
@login_required
def add_bookmark():
    token = request.headers.get('Authorization')
    if token.startswith('Bearer '):
        token = token[7:]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id = payload['user_id']
    
    data = request.get_json()
    book_id = data.get('book_id')
    title = data.get('title')
    response_data = data.get('response_data')
    note = data.get('note')
    
    if not all([book_id, title, response_data]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    bookmark = db.add_bookmark(
        user_id=user_id,
        book_id=book_id,
        title=title,
        response_data=response_data,
        note=note
    )
    
    return jsonify({
        'message': 'Bookmark added successfully',
        'bookmark_id': bookmark.id
    }), 201

@auth_bp.route('/trending', methods=['GET'])
def get_trending():
    limit = request.args.get('limit', default=10, type=int)
    trending = db.get_trending_books(limit)
    return jsonify([{
        'book_id': t.book_id,
        'title': t.title,
        'search_count': t.search_count,
        'last_searched': t.last_searched.isoformat()
    } for t in trending])

@auth_bp.route('/bookmarks/list', methods=['GET'])
@login_required
def list_bookmarks():
    """Get a list of bookmarks with minimal data"""
    token = request.headers.get('Authorization')
    if token.startswith('Bearer '):
        token = token[7:]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id = payload['user_id']
    
    bookmarks = db.get_user_bookmarks(user_id)
    return jsonify([{
        'id': b.id,
        'book_id': b.book_id,
        'title': b.title,
        'created_at': b.created_at.isoformat(),
        'note': b.note
    } for b in bookmarks])

@auth_bp.route('/search/history', methods=['GET'])
@login_required
def get_search_history():
    """Get user's search history"""
    token = request.headers.get('Authorization')
    if token.startswith('Bearer '):
        token = token[7:]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id = payload['user_id']
    
    session = db.Session()
    try:
        searches = session.query(SearchHistory)\
            .filter_by(user_id=user_id)\
            .order_by(SearchHistory.search_date.desc())\
            .all()
        
        return jsonify([{
            'book_id': s.book_id,
            'title': s.title,
            'search_date': s.search_date.isoformat()
        } for s in searches])
    finally:
        session.close()

@auth_bp.route('/bookmarks/<string:bookmark_id>', methods=['GET'])
@login_required
def get_bookmark(bookmark_id):
    """Get full bookmark data by ID"""
    token = request.headers.get('Authorization')
    if token.startswith('Bearer '):
        token = token[7:]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id = payload['user_id']
    
    session = db.Session()
    try:
        bookmark = session.query(Bookmark).filter_by(
            id=bookmark_id,
            user_id=user_id
        ).first()
        
        if not bookmark:
            return jsonify({'error': 'Bookmark not found'}), 404
            
        return jsonify({
            'id': bookmark.id,
            'book_id': bookmark.book_id,
            'title': bookmark.title,
            'note': bookmark.note,
            'response_data': json.loads(bookmark.response_data),
            'created_at': bookmark.created_at.isoformat()
        })
    finally:
        session.close() 