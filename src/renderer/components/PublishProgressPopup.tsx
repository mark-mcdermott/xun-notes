import React, { useEffect, useState, useRef } from 'react';

interface PublishStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

type PublishStatus = 'pending' | 'preparing' | 'pushing' | 'building' | 'deploying' | 'completed' | 'failed';

interface PublishProgressPopupProps {
  status: PublishStatus;
  progress: number;
  steps: PublishStep[];
  error: string | null;
  onClose: () => void;
}

export const PublishProgressPopup: React.FC<PublishProgressPopupProps> = ({
  status,
  steps,
  error,
  onClose
}) => {
  const [estimatedTimeMs, setEstimatedTimeMs] = useState(30000); // Default 30 seconds
  const [elapsedMs, setElapsedMs] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const animationRef = useRef<number | null>(null);

  // Fetch average publish time on mount
  useEffect(() => {
    const fetchAverageTime = async () => {
      try {
        const result = await window.electronAPI.publish.getAverageTime();
        if (result.success && result.averageMs) {
          setEstimatedTimeMs(result.averageMs);
        }
      } catch {
        // Use default
      }
    };
    fetchAverageTime();
    startTimeRef.current = Date.now();
  }, []);

  // Animate progress bar based on elapsed time
  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      // Jump to 100% when complete
      if (status === 'completed') {
        setDisplayProgress(100);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);

      // Use an easing function that slows down as it approaches 95%
      // Progress never exceeds 95% until actually complete
      const rawProgress = elapsed / estimatedTimeMs;
      // Ease-out function: starts fast, slows as it approaches target
      const easedProgress = 1 - Math.pow(1 - Math.min(rawProgress, 1), 2);
      const cappedProgress = Math.min(easedProgress * 95, 95);

      setDisplayProgress(cappedProgress);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, estimatedTimeMs]);

  // Get the current step message
  const getCurrentStepMessage = () => {
    const inProgressStep = steps.find(s => s.status === 'in_progress');
    if (inProgressStep) {
      return inProgressStep.message || inProgressStep.name;
    }
    // If no in-progress step, show the last completed one or the status
    const completedSteps = steps.filter(s => s.status === 'completed');
    if (completedSteps.length > 0) {
      const lastCompleted = completedSteps[completedSteps.length - 1];
      return lastCompleted.message || lastCompleted.name;
    }
    // Default to status
    return status.charAt(0).toUpperCase() + status.slice(1) + '...';
  };

  const canClose = status === 'completed' || status === 'failed';

  // Format elapsed time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(246, 246, 246, 0.25)',
        zIndex: 9999
      }}
      onClick={() => canClose && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
          padding: '24px',
          borderRadius: '12px'
        }}
      >
        <h2 className="font-semibold mb-4" style={{ fontSize: '18px', color: '#18181b' }}>
          Publishing Blog Post
        </h2>

        <div className="mb-4">
          {/* Progress bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ backgroundColor: '#e5e7eb', height: '8px' }}
          >
            <div
              className="rounded-full"
              style={{
                width: `${Math.max(displayProgress, 2)}%`,
                height: '8px',
                backgroundColor:
                  status === 'failed' ? '#ef4444' : status === 'completed' ? '#22c55e' : '#7c3aed',
                transition: status === 'completed' ? 'width 0.3s ease-out' : 'none'
              }}
            />
          </div>
          <div style={{ height: '12px' }} />

          {/* Current status message */}
          <div className="flex items-center justify-between">
            <p
              style={{
                fontSize: '14px',
                color: status === 'failed' ? '#ef4444' : status === 'completed' ? '#22c55e' : '#71717a'
              }}
            >
              {status === 'completed' ? 'Published successfully!' : status === 'failed' ? 'Failed' : getCurrentStepMessage()}
            </p>
            {status !== 'completed' && status !== 'failed' && (
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                {formatTime(elapsedMs)}
              </span>
            )}
          </div>

          {error && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}
            >
              <p style={{ fontSize: '14px', color: '#ef4444' }}>{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          {canClose && (
            <button
              onClick={onClose}
              className="transition-colors"
              style={{
                padding: '11px 20px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#52525b',
                backgroundColor: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '8px',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f2')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
