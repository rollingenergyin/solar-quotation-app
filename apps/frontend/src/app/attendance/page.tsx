'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { attendanceApi, type AttendanceDay, formatTime, statusLabel, statusColor } from '@/lib/attendance-api';
import { queueOfflineAction, registerOnlineSync } from '@/lib/attendance-offline';

// ─── GPS ──────────────────────────────────────────────────────────────────────

type GPSState = 'idle' | 'loading' | 'success' | 'error';

function useGPS() {
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<GPSState>('idle');
  const watchIdRef = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const acquire = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Location services not supported on this browser.');
      setGpsState('error');
      return;
    }
    stopWatch();
    setGpsState('loading');
    setGpsError(null);
    setCoords(null);

    const onSuccess = (pos: GeolocationPosition) => {
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setGpsState('success');
      stopWatch();
    };

    const onError = (err: GeolocationPositionError) => {
      stopWatch();
      if (err.code === 1) {
        setGpsError('Location permission denied. Please allow location access in your browser settings and retry.');
      } else {
        // High-accuracy failed — fall back to low-accuracy (WiFi/IP) silently
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setGpsError('Unable to get location. Please check that location access is allowed in your browser and retry.');
            setGpsState('error');
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      }
    };

    // Try high-accuracy first (GPS chip); short timeout so fallback fires quickly
    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, [stopWatch]);

  // Cleanup watch on unmount
  useEffect(() => () => stopWatch(), [stopWatch]);

  return { coords, gpsError, gpsState, acquire };
}

// ─── GPS Status Panel ─────────────────────────────────────────────────────────

function GPSStatusPanel({ gpsState, gpsError, coords, acquire }: {
  gpsState: GPSState;
  gpsError: string | null;
  coords: { lat: number; lng: number; accuracy?: number } | null;
  acquire: () => void;
}) {
  return (
    <div className={`rounded-xl p-3 text-xs border ${
      gpsState === 'success' ? 'bg-green-50 border-green-200' :
      gpsState === 'error'   ? 'bg-red-50 border-red-200' :
      gpsState === 'loading' ? 'bg-blue-50 border-blue-200' :
                               'bg-gray-50 border-gray-200'
    }`}>
      <div className="font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
        <span>{gpsState === 'success' ? '📍' : gpsState === 'error' ? '⚠️' : gpsState === 'loading' ? '🔄' : '📡'}</span>
        GPS Location
      </div>

      {gpsState === 'idle' && (
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Location not yet acquired.</span>
          <button
            type="button"
            onClick={acquire}
            className="ml-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg px-3 py-1.5 font-medium"
          >
            Get Location
          </button>
        </div>
      )}

      {gpsState === 'loading' && (
        <div className="flex items-center gap-2 text-blue-700">
          <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Acquiring your location… please wait</span>
        </div>
      )}

      {gpsState === 'error' && (
        <div className="space-y-2">
          <p className="text-red-700">{gpsError}</p>
          <button
            type="button"
            onClick={acquire}
            className="bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg px-3 py-1.5 font-medium"
          >
            Retry Location
          </button>
        </div>
      )}

      {gpsState === 'success' && coords && (
        <div className="space-y-1">
          <p className="text-green-700 font-medium">Location acquired ✓</p>
          <p className="text-gray-600">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            {coords.accuracy != null && (
              <span className={`ml-1 ${coords.accuracy < 50 ? 'text-green-600' : coords.accuracy < 200 ? 'text-yellow-600' : 'text-orange-600'}`}>
                (±{Math.round(coords.accuracy)}m{coords.accuracy > 200 ? ' — low accuracy' : ''})
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={acquire}
            className="text-blue-600 underline text-xs mt-0.5"
          >
            Refresh location
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraCapture({ onCapture, label }: { onCapture: (base64: string) => void; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  // After cameraOn flips to true, the <video> element mounts — attach stream here
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(() => {
        // Autoplay blocked on some browsers — not fatal, tap-to-play works
      });
    }
  }, [cameraOn]);

  const startCamera = async () => {
    setCamError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('NotSupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true); // mounts <video>, then the useEffect above attaches the stream
    } catch (err: any) {
      const name: string = err?.name ?? err?.message ?? '';
      if (name.includes('NotAllowed') || name.includes('Permission') || name.includes('Denied')) {
        setCamError('Camera permission denied. Please allow camera access in your browser/device settings, then retry.');
      } else if (name.includes('NotFound') || name.includes('DevicesNotFound')) {
        setCamError('No camera found on this device.');
      } else if (name.includes('NotSupported') || name.includes('Insecure')) {
        setCamError('Camera not supported. Make sure the page is served over HTTPS or localhost.');
      } else if (name.includes('NotReadable') || name.includes('TrackStart')) {
        setCamError('Camera is in use by another app. Please close it and retry.');
      } else {
        setCamError(`Could not start camera (${name || 'unknown error'}). Please retry.`);
      }
    } finally {
      setStarting(false);
    }
  };

  const takeSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;
    // Cap at 800px wide to keep payload small
    const maxW = 800;
    const scale = srcW > maxW ? maxW / srcW : 1;
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror horizontally so selfie looks natural
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    setCaptured(dataUrl);
    onCapture(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  // Stop stream when component unmounts
  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* Open camera button */}
      {!cameraOn && !captured && (
        <button
          type="button"
          onClick={startCamera}
          disabled={starting}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-60 transition-colors"
        >
          {starting ? (
            <>
              <svg className="animate-spin h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm font-medium">Starting camera…</span>
            </>
          ) : (
            <>
              <span className="text-4xl">📷</span>
              <span className="text-sm font-medium">Open Camera for Selfie</span>
              <span className="text-xs text-gray-400">Live camera only</span>
            </>
          )}
        </button>
      )}

      {/* Error */}
      {camError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-sm text-red-700">{camError}</p>
          <button type="button" onClick={startCamera} className="text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5">
            Retry Camera
          </button>
        </div>
      )}

      {/* Live viewfinder */}
      {cameraOn && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          {/* Mirror the video preview so it feels like a selfie mirror */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            playsInline
            muted
            autoPlay
          />
          <div className="absolute bottom-4 inset-x-0 flex justify-center gap-4">
            <button
              type="button"
              onClick={takeSelfie}
              className="bg-white text-gray-900 font-bold rounded-full w-16 h-16 flex items-center justify-center shadow-xl border-4 border-yellow-400 text-2xl active:scale-95 transition-transform"
              aria-label="Take photo"
            >
              ●
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow text-xl active:scale-95 transition-transform"
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="bg-black/50 text-white text-xs rounded-full px-3 py-1">Tap ● to capture</span>
          </div>
        </div>
      )}

      {/* Captured preview */}
      {captured && (
        <div className="relative rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={captured} alt="Selfie preview" className="w-full rounded-xl" />
          <button
            type="button"
            onClick={retake}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg px-3 py-1.5 transition-colors"
          >
            Retake
          </button>
          <div className="absolute bottom-2 left-2 bg-green-600/90 text-white text-xs rounded-lg px-2 py-1">
            ✓ Selfie captured
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── Work Location Picker ─────────────────────────────────────────────────────

function WorkLocationPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Work Location</label>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'OFFICE', label: 'Office', icon: '🏢' },
          { id: 'ON_FIELD', label: 'On Field', icon: '🚗' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium border-2 transition-colors ${
              value === opt.id
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="text-lg">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Check In Form ────────────────────────────────────────────────────────────

function CheckInForm({ onSuccess }: { onSuccess: () => void }) {
  const [selfie, setSelfie] = useState('');
  const [description, setDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('OFFICE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { coords, gpsError, gpsState, acquire } = useGPS();

  useEffect(() => { acquire(); }, [acquire]);

  const submit = async () => {
    if (!selfie) return setError('Please take a selfie first');
    if (!description.trim()) return setError('Please enter your check-in description');

    setLoading(true);
    setError('');
    const payload = {
      selfieBase64: selfie,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      accuracyM: coords?.accuracy,
      description,
      workLocation,
      deviceInfo: navigator.userAgent,
      clientCapturedAt: new Date().toISOString(),
    };
    try {
      if (!navigator.onLine) {
        queueOfflineAction({ type: 'CHECK_IN', payload });
        setError('You are offline. Check-in has been queued and will sync automatically when you reconnect.');
      } else {
        await attendanceApi.checkIn(payload);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Check-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <CameraCapture onCapture={setSelfie} label="Take Selfie (mandatory)" />

      <WorkLocationPicker value={workLocation} onChange={setWorkLocation} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What are you working on today? <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of today's tasks…"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
      </div>

      <GPSStatusPanel gpsState={gpsState} gpsError={gpsError} coords={coords} acquire={acquire} />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-4 text-base transition-colors"
      >
        {loading ? 'Checking in…' : 'Check In'}
      </button>
    </div>
  );
}

// ─── Check Out Form ───────────────────────────────────────────────────────────

function CheckOutForm({ onSuccess }: { onSuccess: () => void }) {
  const [selfie, setSelfie] = useState('');
  const [description, setDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('OFFICE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { coords, gpsError, gpsState, acquire } = useGPS();

  useEffect(() => { acquire(); }, [acquire]);

  const submit = async () => {
    if (!selfie) return setError('Please take a selfie for check-out');
    if (!description.trim()) return setError('Please enter a short description');

    setLoading(true);
    setError('');
    const payload = {
      selfieBase64: selfie,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      accuracyM: coords?.accuracy,
      description,
      workLocation,
      clientCapturedAt: new Date().toISOString(),
    };
    try {
      if (!navigator.onLine) {
        queueOfflineAction({ type: 'CHECK_OUT', payload });
        setError('You are offline. Check-out has been queued and will sync when you reconnect.');
      } else {
        await attendanceApi.checkOut(payload);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Check-out failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <CameraCapture onCapture={setSelfie} label="Check-Out Selfie (mandatory)" />

      <WorkLocationPicker value={workLocation} onChange={setWorkLocation} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Short End-of-Day Note <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly what did you finish today?"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">You can add a detailed update separately after checkout.</p>
      </div>

      <GPSStatusPanel gpsState={gpsState} gpsError={gpsError} coords={coords} acquire={acquire} />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-4 text-base transition-colors"
      >
        {loading ? 'Checking out…' : 'Check Out'}
      </button>
    </div>
  );
}

// ─── Daily Log Form ───────────────────────────────────────────────────────────

function DailyLogForm({ existing, onSaved }: { existing?: { dailyUpdate?: string | null; tomorrowPlan?: string | null }; onSaved: () => void }) {
  const [dailyUpdate, setDailyUpdate] = useState(existing?.dailyUpdate ?? '');
  const [tomorrowPlan, setTomorrowPlan] = useState(existing?.tomorrowPlan ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!dailyUpdate.trim()) return setError('Please enter your full day work update');
    if (!tomorrowPlan.trim()) return setError("Please enter tomorrow's plan");

    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await attendanceApi.saveDailyLog({ dailyUpdate, tomorrowPlan });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Day Work Update <span className="text-red-500">*</span>
        </label>
        <textarea
          value={dailyUpdate}
          onChange={(e) => setDailyUpdate(e.target.value)}
          placeholder="Detail what you accomplished today — tasks completed, meetings, site visits…"
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tomorrow&apos;s Plan <span className="text-red-500">*</span>
        </label>
        <textarea
          value={tomorrowPlan}
          onChange={(e) => setTomorrowPlan(e.target.value)}
          placeholder="What will you do tomorrow? Meetings, site visits, deliverables…"
          rows={3}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
      {saved && <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">Daily log saved!</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-gray-900 font-semibold rounded-xl py-3 text-sm transition-colors"
      >
        {saving ? 'Saving…' : (existing?.dailyUpdate ? 'Update Daily Log' : 'Save Daily Log')}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [today, setToday] = useState<{ date: string; day: AttendanceDay | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'status' | 'checkin' | 'checkout'>('status');
  const [offlineBanner, setOfflineBanner] = useState('');
  const [showLogForm, setShowLogForm] = useState(false);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceApi.getToday();
      setToday(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cleanup = registerOnlineSync((result) => {
      setOfflineBanner(`Synced ${result.synced} offline action(s) successfully.`);
      setTimeout(() => setOfflineBanner(''), 5000);
      loadToday();
    });
    return cleanup;
  }, [loadToday]);

  useEffect(() => { loadToday(); }, [loadToday]);

  const handleCheckInSuccess = async () => {
    await loadToday();
    setView('status');
  };

  const handleCheckOutSuccess = async () => {
    await loadToday();
    setView('status');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">Loading attendance…</div>
      </div>
    );
  }

  const day = today?.day;
  const status = day?.status ?? 'NONE';
  const showDailyLog = status === 'IN_PROGRESS' || status === 'COMPLETE';
  const hasLog = !!(day?.dailyUpdate);

  const locationLabel = (loc?: string | null) =>
    loc === 'ON_FIELD' ? '🚗 On Field' : loc === 'OFFICE' ? '🏢 Office' : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {offlineBanner && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{offlineBanner}</div>
      )}

      {/* Date header */}
      <div className="text-center">
        <div className="text-3xl mb-1">
          {status === 'COMPLETE' ? '✅' : status === 'IN_PROGRESS' ? '🕐' : '⏳'}
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h1>
        <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-medium ${statusColor(status as any)}`}>
          {statusLabel(status as any)}
        </span>
      </div>

      {/* Today summary card */}
      {day && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {day.isLate && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700">
              Late by {day.lateMinutes} minutes
            </div>
          )}
          {day.isSunday && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-700">
              Working on Sunday — Comp Off will be auto-requested
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">Check In</div>
              <div className="font-semibold text-green-700">{formatTime(day.checkIn?.capturedAt)}</div>
              {locationLabel(day.checkIn?.workLocation) && (
                <div className="text-xs text-gray-500 mt-0.5">{locationLabel(day.checkIn?.workLocation)}</div>
              )}
              {day.checkIn?.description && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{day.checkIn.description}</div>
              )}
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-0.5">Check Out</div>
              <div className="font-semibold text-blue-700">{formatTime(day.checkOut?.capturedAt)}</div>
              {locationLabel(day.checkOut?.workLocation) && (
                <div className="text-xs text-gray-500 mt-0.5">{locationLabel(day.checkOut?.workLocation)}</div>
              )}
              {day.checkOut?.description && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{day.checkOut.description}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {view === 'status' && (
        <div className="space-y-3">
          {status === 'NONE' && (
            <button
              onClick={() => setView('checkin')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl py-5 text-lg shadow-md transition-colors"
            >
              Check In Now
            </button>
          )}
          {status === 'IN_PROGRESS' && (
            <button
              onClick={() => setView('checkout')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl py-5 text-lg shadow-md transition-colors"
            >
              Check Out
            </button>
          )}
          {status === 'COMPLETE' && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center text-green-700 font-medium">
              Attendance complete for today!
            </div>
          )}
        </div>
      )}

      {/* Daily Log section — visible once checked in */}
      {showDailyLog && view === 'status' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowLogForm((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {hasLog ? 'Daily Work Log' : 'Add Daily Work Log'}
                </div>
                <div className="text-xs text-gray-500">
                  {hasLog ? 'Tap to update your work log' : 'Full day update + tomorrow\'s plan'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasLog && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Saved</span>}
              <span className="text-gray-400 text-lg">{showLogForm ? '▲' : '▼'}</span>
            </div>
          </button>

          {showLogForm && (
            <div className="border-t border-gray-100 p-4">
              <DailyLogForm
                existing={{ dailyUpdate: day?.dailyUpdate, tomorrowPlan: day?.tomorrowPlan }}
                onSaved={async () => { await loadToday(); }}
              />
            </div>
          )}

          {/* Show saved log summary */}
          {!showLogForm && hasLog && (
            <div className="border-t border-gray-50 px-4 pb-4 space-y-2">
              <div>
                <div className="text-xs font-medium text-gray-500 mb-0.5">Work Update</div>
                <p className="text-xs text-gray-700 line-clamp-3">{day?.dailyUpdate}</p>
              </div>
              {day?.tomorrowPlan && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-0.5">Tomorrow&apos;s Plan</div>
                  <p className="text-xs text-gray-700 line-clamp-2">{day.tomorrowPlan}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Check-in form */}
      {view === 'checkin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Check In</h2>
            <button onClick={() => setView('status')} className="text-sm text-gray-500">Cancel</button>
          </div>
          <CheckInForm onSuccess={handleCheckInSuccess} />
        </div>
      )}

      {/* Check-out form */}
      {view === 'checkout' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Check Out</h2>
            <button onClick={() => setView('status')} className="text-sm text-gray-500">Cancel</button>
          </div>
          <CheckOutForm onSuccess={handleCheckOutSuccess} />
        </div>
      )}
    </div>
  );
}
