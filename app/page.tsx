import Image from "next/image";

export default function Home() {
  return (
    <main className="coming-soon">
      <div className="brand-lockup">
        <div className="logo-frame">
          <Image
            className="brand-logo"
            src="/branding/jb-squeaky-logo.JPG"
            alt="JB Squeaky Cleaners LLC"
            width={1170}
            height={660}
            sizes="(max-width: 640px) 90vw, 640px"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className="launch-status">
          <span className="brand-rule" aria-hidden="true" />
          <h1>COMING SOON</h1>
        </div>
      </div>
    </main>
  );
}
