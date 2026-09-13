import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, RotateCcw } from 'lucide-react'
import ImageCropper from './ImageCropper'

// Λήψη ταυτοποιητικού: άνοιγμα κάμερας (getUserMedia) για φωτογραφία, ή επιλογή αρχείου
// εικόνας από τον υπολογιστή. onChange(dataUrl | null) με την τελική εικόνα (JPEG/PNG).
export default function CameraCapture({ onChange, label = 'Ταυτοποιητικό (κάρτα ταυτότητας Δομής)' }) {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [captured, setCaptured] = useState(null)
  const [cropping, setCropping] = useState(null) // dataUrl προς περικοπή (4 γωνίες)
  const [camError, setCamError] = useState(null)

  function stopStream() {
    setStream((s) => {
      if (s) s.getTracks().forEach((t) => t.stop())
      return null
    })
  }

  // Σύνδεση του stream στο <video> ΑΦΟΥ έχει γίνει render (αλλιώς το ref είναι null → μαύρη οθόνη).
  useEffect(() => {
    const v = videoRef.current
    if (v && stream) {
      v.srcObject = stream
      const play = () => v.play().catch(() => {})
      if (v.readyState >= 2) play()
      else v.onloadedmetadata = play
    }
  }, [stream])

  // Cleanup στο unmount.
  useEffect(() => () => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
  }, [stream])

  async function startCam() {
    setCamError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setStream(s)
    } catch (err) {
      setCamError('Δεν ήταν δυνατή η πρόσβαση στην κάμερα. Χρησιμοποιήστε «Επιλογή αρχείου».')
    }
  }

  function shoot() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    setCropping(c.toDataURL('image/jpeg', 0.92)) // βήμα περικοπής 4 γωνιών
    stopStream()
  }

  function onFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropping(reader.result) // βήμα περικοπής
    reader.readAsDataURL(file)
  }

  function onCropped(dataUrl) {
    setCropping(null)
    setCaptured(dataUrl)
    onChange && onChange(dataUrl)
  }

  function retake() {
    setCaptured(null)
    setCropping(null)
    onChange && onChange(null)
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      {cropping ? (
        <ImageCropper src={cropping} onCropped={onCropped} onCancel={() => setCropping(null)} />
      ) : captured ? (
        <div className="space-y-2">
          <img src={captured} alt="Ταυτοποιητικό" className="max-h-56 rounded-md border border-slate-200" />
          <button
            type="button"
            onClick={retake}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={13} /> Νέα λήψη
          </button>
        </div>
      ) : (
        <>
          {stream && (
            <video ref={videoRef} autoPlay playsInline muted className="max-h-56 w-full rounded-md border border-slate-200 bg-black" />
          )}
          <div className="flex flex-wrap gap-2">
            {stream ? (
              <button
                type="button"
                onClick={shoot}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Camera size={15} /> Λήψη φωτογραφίας
              </button>
            ) : (
              <button
                type="button"
                onClick={startCam}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                <Camera size={15} /> Άνοιγμα κάμερας
              </button>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Upload size={15} /> Επιλογή αρχείου
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
          {camError && <p className="text-xs text-amber-600">{camError}</p>}
        </>
      )}
    </div>
  )
}
