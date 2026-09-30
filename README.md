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
- **Framework:** FastAPI (Python 3.10+)
- **Networking:** HTTPX + Gradio Client
- **Image Processing:** Pillow (PIL)
- **Secrets:** python-dotenv

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (3.10+)
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
5. Run the FastAPI development server (use one worker for the in-memory job queue):
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

## Image generation reliability

The editor submits a background job and polls its status, so GPU queue waits do not hold a single browser request open. It shows the real queue state, supports cancellation, and tries each configured Hugging Face Space once. Each Space has an 80-second deadline; the complete backend job has a 180-second limit. Browser requests have a 200-second overall limit. Cancellation removes queued jobs where the upstream service supports it; inference already running on a GPU can continue remotely.

The free Hugging Face path uses the Space's Lightning settings: four steps, guidance 1.0, and a 512px maximum output side by default. To request larger output through the backend, set `IMAGE_OUTPUT_SIZE=1024` in `backend/.env` and restart it. The browser-only fallback also uses 512px output and bounded, cancellable requests. Generated images are downloaded before success is reported. Invalid uploads are rejected instead of being sent to a GPU.

Hugging Face ZeroGPU is a shared, quota-limited service. A token uses that account's quota; creating several tokens for the same account does not add GPU time. The UI reports exhausted quota and unavailable GPUs as terminal errors. Set `HF_SPACE` or `HF_SPACES` to use a deployment you control.

For a dedicated paid alternative, the backend supports [fal's Qwen camera-angle API](https://fal.ai/models/fal-ai/qwen-image-edit-2511-multiple-angles/api). Enable it explicitly in `backend/.env`:

```env
IMAGE_PROVIDER=fal
FAL_KEY=your_fal_api_key
```

Restart the backend after changing configuration. This path uses fal's regular-model settings (28 steps, guidance 4.5), maps Oraa's camera distance to fal's zoom scale, and retains the same job status and Cancel controls. It requires API credits. Keep `FAL_KEY` in the backend; never put it in a `VITE_*` environment variable. The default `IMAGE_PROVIDER=huggingface` makes no paid API calls.

Regression checks:

```bash
cd backend
./venv/bin/python -m unittest discover -s tests -v
cd ../frontend
npm test
npm run lint
npm run build
```

Job results are kept in memory for ten minutes and up to twenty completed jobs. Restarting the backend clears them. Multiple backend workers would need a shared queue and result store.

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
