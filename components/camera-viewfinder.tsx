"use client"

import { useRef, useEffect, useState } from "react"

interface CameraViewfinderProps {
  onCapture: (imageData: string) => void
  isProcessing: boolean
}

export function CameraViewfinder({ onCapture, isProcessing }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error("Camera access denied:", err)
        setHasCamera(false)
        setCameraError("Camera access denied or unavailable")
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleCapture = () => {
    if (isProcessing) return

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL("image/jpeg", 0.8)
        onCapture(imageData)
      }
    } else {
      // Demo mode - simulate capture
      onCapture("demo-capture")
    }
  }

  return (
    <div className="relative flex-1 bg-black overflow-hidden">
      {hasCamera ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
          <div className="w-32 h-24 border-2 border-dashed border-zinc-600 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-sm text-center px-8">
            {cameraError || "Camera preview unavailable"}
          </p>
          <p className="text-zinc-500 text-xs mt-2">Tap capture to simulate</p>
        </div>
      )}

      {/* Viewfinder overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner guides */}
        <div className="absolute top-8 left-8 w-12 h-12 border-l-2 border-t-2 border-white/60 rounded-tl-lg" />
        <div className="absolute top-8 right-8 w-12 h-12 border-r-2 border-t-2 border-white/60 rounded-tr-lg" />
        <div className="absolute bottom-32 left-8 w-12 h-12 border-l-2 border-b-2 border-white/60 rounded-bl-lg" />
        <div className="absolute bottom-32 right-8 w-12 h-12 border-r-2 border-b-2 border-white/60 rounded-br-lg" />

        {/* Center receipt hint */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/40 text-sm">
          Position receipt here
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Capture button - raised above the bottom action bar to avoid overlap */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none">
        <button
          onClick={handleCapture}
          disabled={isProcessing}
          className="pointer-events-auto h-24 w-24 rounded-full bg-amber-400 p-1.5 shadow-2xl flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Capture receipt"
        >
          <span className="flex h-full w-full items-center justify-center rounded-full border-4 border-amber-200 bg-red-600">
            <span className="h-14 w-14 rounded-full bg-red-500 ring-2 ring-red-300" />
          </span>
        </button>
      </div>
    </div>
  )
}
