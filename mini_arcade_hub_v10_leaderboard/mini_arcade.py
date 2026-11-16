"""Launch Mini Arcade Hub.

Feature code is organized in separate modules. Run this file or run_game.bat.
"""
import tkinter as tk
from app import MiniArcade


if __name__ == "__main__":
    root = tk.Tk()
    app = MiniArcade(root)
    root.mainloop()
