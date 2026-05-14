import './FullPageSkeleton.css';

export function FullPageSkeleton(): JSX.Element {
  return (
    <div className="fps">
      <div className="fps__nav shimmer" />
      <div className="fps__main">
        <div className="fps__hero shimmer" />
        <div className="fps__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="fps__card shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
