import eel
import os
import tkinter as tk
from tkinter import messagebox

current_dir = os.path.dirname(os.path.abspath(__file__))
eel.init(current_dir)

@eel.expose
def my_python_function(a, b):
    return a + b

try:
    eel.start('Bus342.html', size=(300, 200))
except OSError as e:
    if "Can't find Google Chrome/Chromium installation" in str(e):
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Uh oh!", "It seems that we can't find a Chromium installation on your device, please install Chromium or Google Chrome to view bus routes")
