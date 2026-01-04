import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

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
  postUrl?: string | null;
  onClose: () => void;
}

export const PublishProgressPopup: React.FC<PublishProgressPopupProps> = ({
  status,
  steps,
  error,
  postUrl,
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
        top: '55px',
        right: '12px',
        width: '160px',
        backgroundColor: 'var(--dialog-bg)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.12)',
        padding: '8px',
        borderRadius: '6px',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
    >
      {/* Header with title and close button */}
      <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dialog-heading)' }}>
          {status === 'completed' ? 'Published!' : status === 'failed' ? 'Failed' : 'Publishing...'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--btn-secondary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--progress-bg)', height: '3px', marginBottom: '3px' }}
      >
        <div
          className="rounded-full"
          style={{
            width: `${Math.max(displayProgress, 2)}%`,
            height: '3px',
            backgroundColor:
              status === 'failed' ? 'var(--status-error)' : status === 'completed' ? 'var(--status-success)' : 'var(--progress-fill)',
            transition: status === 'completed' ? 'width 0.3s ease-out' : 'none'
          }}
        />
      </div>

      {/* Current status message */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p
            style={{
              fontSize: '12px',
              color: status === 'failed' ? 'var(--status-error)' : status === 'completed' ? 'var(--status-success)' : 'var(--dialog-text)'
            }}
          >
            {status === 'completed' ? 'Success!' : status === 'failed' ? 'Failed' : getCurrentStepMessage()}
          </p>
          {status === 'completed' && postUrl && (
            <button
              onClick={() => window.electronAPI.shell.openExternal(postUrl)}
              style={{
                fontSize: '12px',
                color: 'var(--accent-primary)',
                background: 'none',
                border: 'none',
                padding: 0,
                marginLeft: '6px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              post
            </button>
          )}
        </div>
        {status !== 'completed' && status !== 'failed' && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {formatTime(elapsedMs)}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: '4px',
            padding: '3px',
            borderRadius: '2px',
            backgroundColor: 'var(--status-error-bg)',
            border: '1px solid var(--status-error-border)'
          }}
        >
          <p style={{ fontSize: '5px', color: 'var(--status-error)' }}>{error}</p>
        </div>
      )}
    </div>
  );
};
