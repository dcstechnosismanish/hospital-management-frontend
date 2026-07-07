import { useRouter } from 'next/router';

export default function BackButton({ fallback = '/' }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      style={{
        padding: '9px 16px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        background: 'var(--hover-bg)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}
    >
      <i className="fa-solid fa-arrow-left" />
    </button>
  );
}
