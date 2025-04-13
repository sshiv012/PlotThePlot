from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from os import path
import bcrypt
import json
from typing import Optional
from sqlalchemy.sql import text
import uuid
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()
ROOT = path.dirname(path.realpath(__file__))

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(60), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    searches = relationship("SearchHistory", back_populates="user")
    bookmarks = relationship("Bookmark", back_populates="user")
    
    def set_password(self, password: str) -> None:
        """Hash and set the user's password"""
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """Verify the user's password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

class SearchHistory(Base):
    __tablename__ = 'search_history'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    book_id = Column(String(100), nullable=False)  # Could be ISBN or other unique identifier
    title = Column(String(200), nullable=False)  # Store the book title
    search_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="searches")

class Bookmark(Base):
    __tablename__ = 'bookmarks'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    book_id = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    response_data = Column(Text, nullable=False)  # Store complete response as JSON string
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="bookmarks")

# Remove BookAnalytics table and create a view instead
class BookAnalytics(Base):
    __tablename__ = 'book_analytics'
    __table_args__ = {'info': {'is_view': True}}
    
    book_id = Column(String(100), primary_key=True)
    title = Column(String(200), nullable=False)
    search_count = Column(Integer, nullable=False)
    last_searched = Column(DateTime, nullable=False)

    @classmethod
    def create_view(cls, engine):
        """Create the analytics view"""
        try:
            with engine.connect() as conn:                
                # Drop view if it exists
                conn.execute(text("DROP VIEW IF EXISTS book_analytics"))
                conn.commit()
                
                # Create the view
                conn.execute(text("""
                    CREATE VIEW book_analytics AS
                    SELECT 
                        book_id,
                        title,
                        COUNT(*) as search_count,
                        MAX(search_date) as last_searched
                    FROM search_history
                    GROUP BY book_id, title
                    ORDER BY search_count DESC, last_searched DESC
                """))
                conn.commit()
        except Exception as e:
            logger.error(f"Error creating book_analytics view: {str(e)}")
            raise

class Database:
    def __init__(self, db_filename: str = "plottheplot.db"):
        db_url = f"sqlite:///{path.join(ROOT, db_filename)}"
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        Base.metadata.create_all(self.engine)
        # Create the view after tables are created
        BookAnalytics.create_view(self.engine)
    
    def create_user(self, username: str, password: str) -> Optional[User]:
        """Create a new user with hashed password"""
        session = self.Session()
        try:
            if session.query(User).filter_by(username=username).first():
                return None
            
            user = User(username=username)
            user.set_password(password)
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        finally:
            session.close()
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate a user and return the user object if successful"""
        session = self.Session()
        try:
            user = session.query(User).filter_by(username=username).first()
            if user and user.check_password(password):
                return user
            return None
        finally:
            session.close()
    
    def add_search(self, user_id: int, book_id: str, title: str) -> None:
        """Add a search to history and update the view"""
        session = self.Session()
        try:
            search = SearchHistory(
                user_id=user_id,
                book_id=book_id,
                title=title
            )
            session.add(search)
            session.commit()
            # Recreate view after adding new search
            BookAnalytics.create_view(self.engine)
        finally:
            session.close()
    
    def add_bookmark(self, user_id: int, book_id: str, title: str, response_data: dict, note: Optional[str] = None) -> Bookmark:
        """Add a new bookmark"""
        session = self.Session()
        try:
            bookmark = Bookmark(
                user_id=user_id,
                book_id=book_id,
                title=title,
                response_data=json.dumps(response_data),
                note=note
            )
            session.add(bookmark)
            session.commit()
            # Refresh the object to get the generated UUID
            session.refresh(bookmark)
            return bookmark
        finally:
            session.close()
    
    def get_user_bookmarks(self, user_id: int) -> list[Bookmark]:
        """Get all bookmarks for a user"""
        session = self.Session()
        try:
            return session.query(Bookmark).filter_by(user_id=user_id).all()
        finally:
            session.close()
    
    def get_trending_books(self, limit: int = 10) -> list[BookAnalytics]:
        """Get trending books from the view"""
        session = self.Session()
        try:
            return session.query(BookAnalytics)\
                .order_by(BookAnalytics.search_count.desc(), BookAnalytics.last_searched.desc())\
                .limit(limit)\
                .all()
        finally:
            session.close() 