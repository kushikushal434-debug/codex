import os
from app import create_app
from app.seed_data import seed_database
from app.config import Config

app = create_app()

if __name__ == "__main__":
    # Ensure database is seeded with initial demo accounts and files
    seed_database()
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"[*] Starting Trust, Privacy & Digital Provenance Backend on http://{host}:{port}")
    app.run(host=host, port=port, debug=Config.DEBUG)
