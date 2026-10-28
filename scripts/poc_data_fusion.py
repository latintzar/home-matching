import duckdb
import sqlite3
import os
import math
from dataclasses import dataclass
from typing import List, Dict, Any

# Configuration
DATA_DIR = '/Users/peterneyra/puedo_casa/data'
AIRBNB_DB = os.path.join(DATA_DIR, 'airbnb_consolidated_20250902_150025.db')
BURBUJA_DB = os.path.join(DATA_DIR, 'burbuja_data_ultra.duckdb')
REDDIT_DB = os.path.join(DATA_DIR, 'reddit_data_full.duckdb')

@dataclass
class Location:
    lat: float
    lon: float
    address_term: str  # e.g. "Urbanización Camposol" or "Calle Mayor"

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Radius of Earth in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def analyze_airbnb(location: Location, radius_meters=200):
    """Finds listings within radius and checks their reviews."""
    print(f"\n🔎 Searching Airbnb listings within {radius_meters}m of ({location.lat}, {location.lon})...")
    
    if not os.path.exists(AIRBNB_DB):
        print("❌ Airbnb DB not found.")
        return

    try:
        conn = sqlite3.connect(AIRBNB_DB)
        cursor = conn.cursor()
        
        # 1. Bounding box optimization (approx 1 degree lat ~ 111km)
        # 0.002 degrees is roughly 220m
        delta = 0.003 
        min_lat, max_lat = location.lat - delta, location.lat + delta
        min_lon, max_lon = location.lon - delta, location.lon + delta
        
        query = """
            SELECT id, name, latitude, longitude, review_scores_rating, price 
            FROM listings 
            WHERE latitude BETWEEN ? AND ? 
            AND longitude BETWEEN ? AND ?
        """
        cursor.execute(query, (min_lat, max_lat, min_lon, max_lon))
        candidates = cursor.fetchall()
        
        nearby_listings = []
        for cand in candidates:
            lid, name, lat, lon, rating, price = cand
            dist = haversine_distance(location.lat, location.lon, float(lat), float(lon))
            if dist <= radius_meters:
                nearby_listings.append({
                    'id': lid, 'name': name, 'dist': dist, 'rating': rating, 'price': price
                })
        
        print(f"✅ Found {len(nearby_listings)} listings nearby.")
        
        # 2. Fetch Reviews for these listings
        if nearby_listings:
            listing_ids = [L['id'] for L in nearby_listings]
            placeholders = ','.join(['?'] * len(listing_ids))
            
            review_query = f"""
                SELECT listing_id, comments, date 
                FROM reviews 
                WHERE listing_id IN ({placeholders})
                ORDER BY date DESC
            """
            cursor.execute(review_query, listing_ids)
            reviews = cursor.fetchall()
            
            print(f"📝 Analyzed {len(reviews)} reviews.")
            
            # Simple keyword scan
            negative_keywords = ['ruido', 'noise', 'paredes', 'walls', 'olor', 'smell', 'obras', 'construction', 'frio', 'cold']
            flagged_reviews = []
            for r in reviews:
                lid, comment, date = r
                if comment and any(k in comment.lower() for k in negative_keywords):
                    flagged_reviews.append((date, comment[:100] + "..."))
            
            if flagged_reviews:
                print("\n🚩 Potential Red Flags in Reviews:")
                for date, txt in flagged_reviews[:5]:
                    print(f"   - [{date}] {txt.replace(chr(10), ' ')}")
            else:
                print("👍 No immediate red flag keywords found in reviews.")
                
        conn.close()
        
    except Exception as e:
        print(f"Error querying Airbnb: {e}")

def analyze_forums(term: str):
    """Searches Reddit and Burbuja for the specific term."""
    print(f"\n🔎 Searching Forums for term: '{term}'...")
    
    # Reddit
    if os.path.exists(REDDIT_DB):
        try:
            conn = duckdb.connect(REDDIT_DB)
            # Search Posts
            query = f"""
                SELECT title, selftext, subreddit, score, url 
                FROM posts 
                WHERE title ILIKE '%{term}%' OR selftext ILIKE '%{term}%' 
                ORDER BY score DESC 
                LIMIT 3
            """
            results = conn.execute(query).fetchall()
            if results:
                print(f"\n🟢 Reddit Hits ({len(results)}):")
                for r in results:
                    print(f"   - [r/{r[2]}] {r[0]} (Score: {r[3]})")
            else:
                print("\n⚪️ No Reddit hits found.")
            conn.close()
        except Exception as e:
            print(f"Error searching Reddit: {e}")

    # Burbuja
    if os.path.exists(BURBUJA_DB):
        try:
            conn = duckdb.connect(BURBUJA_DB)
            # Search Posts (content)
            # Note: ILIKE is case insensitive
            query = f"""
                SELECT content, created_utc 
                FROM posts 
                WHERE content ILIKE '%{term}%' 
                LIMIT 3
            """
            results = conn.execute(query).fetchall()
            if results:
                print(f"\n🟠 Burbuja Hits ({len(results)}):")
                for r in results:
                    content_preview = r[0][:100].replace('\n', ' ') + "..." if r[0] else "No content"
                    print(f"   - {content_preview}")
            else:
                print("\n⚪️ No Burbuja hits found.")
            conn.close()
        except Exception as e:
            print(f"Error searching Burbuja: {e}")

if __name__ == "__main__":
    # Example: A location in Barcelona (Sagrada Familia area based on sample data)
    # Lat: 41.40556, Lon: 2.17262
    
    target = Location(
        lat=41.403, 
        lon=2.174, 
        address_term="Sagrada Familia"
    )
    
    print(f"--- POC: Data Fusion for Location ---")
    print(f"Target: {target.address_term} ({target.lat}, {target.lon})")
    
    analyze_airbnb(target)
    analyze_forums(target.address_term)
    
    # Also try a forum search for a known problematic urbanization for test
    # analyze_forums("Camposol")

