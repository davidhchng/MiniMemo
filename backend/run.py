"""
Development server launcher.

Run this once and leave it running. Any change to a .py file auto-reloads.
No need to kill and restart manually.

Usage:
    python run.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
