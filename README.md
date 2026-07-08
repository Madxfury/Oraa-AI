# ˖°📸 ༘ Oraa AI

<p align="center">
  <img src="frontend/public/logo.png" alt="Oraa AI Logo" width="120" />
</p>

<p align="center">
  <strong>Advanced Camera Angle Control using LoRA-based image editing.</strong>
</p>

<p align="center">
  <a href="https://github.com/Madxfury/Oraa-AI/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Madxfury/Oraa-AI?style=flat-square&color=emerald" alt="License"></a>
  <a href="https://github.com/Madxfury/Oraa-AI/stargazers"><img src="https://img.shields.io/github/stars/Madxfury/Oraa-AI?style=flat-square&color=emerald" alt="Stars"></a>
  <a href="https://github.com/Madxfury/Oraa-AI/network/members"><img src="https://img.shields.io/github/forks/Madxfury/Oraa-AI?style=flat-square&color=emerald" alt="Forks"></a>
</p>

---

Oraa AI is an interactive web-based playground for **Qwen-Image-Edit (Icedit LoRA)**. It provides a real-time, interactive 3D camera controller that enables users to manipulate and change the camera perspective (azimuth, elevation, and distance) of any input image. 

<img width="1260" height="627" alt="2026-07-08_19-46-21" src="https://github.com/user-attachments/assets/57f07f28-263b-4926-b3be-53de6d8b05f9" />

The application translates intuitive 3D spatial rotations directly into prompt parameters for LoRA-based image transformation, giving you a physical, tactile way to control image editing.

## ✨ Features

- **🎮 Interactive 3D Viewport:** A real-time Three.js / React Three Fiber interactive viewport. Drag handles (🟢 Azimuth, 🩷 Elevation, 🟠 Distance) to orient your virtual camera.
- **🔄 Auto Prompt Synthesis:** Automatically translates the physical angles from the 3D model into precise prompts (`<sks> front-left quarter view eye-level shot close-up`) for the LoRA edit space.
- **⚡ Dual Mode Integration:** Call the Python FastAPI backend wrapper or run direct Gradio client connections to the Hugging Face Space.
- **🎨 Premium Dark UI:** Smooth entrance transitions, custom glassmorphic panels, custom scroll animations, and clean, responsive elements.
- **🛡️ Secure Configs:** Fully set up with environment variable configurations to prevent key leaks on public repositories.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS + Vanilla CSS
- **Animations:** Framer Motion
- **3D Graphics:** Three.js + React Three Fiber (R3F) + Drei

### Backend
- **Framework:** FastAPI (Python 3.9+)
- **Networking:** HTTPX + Gradio Client
- **Image Processing:** Pillow (PIL)
- **Secrets:** python-dotenv

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.9+)
- A [Hugging Face User Access Token](https://huggingface.co/settings/tokens)

---

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables. Copy the example `.env` file and enter your Hugging Face Token:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   HF_TOKEN=your_huggingface_token_here
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173/`.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Build with ❤️‍🔥 by <a href="https://github.com/Madxfury">Sanskar</a>
</p>
