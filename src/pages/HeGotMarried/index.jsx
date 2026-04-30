import { useState } from 'react'
import styles from './HeGotMarried.module.css'

const photos = Array.from(
  { length: 12 },
  (_, idx) => `/images/hegotmarried-${idx + 1}.jpeg`
)

function HeGotMarriedPage() {
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  const closeLightbox = () => setSelectedPhoto(null)

  return (
    <div className={styles.pageContainer}>
      <section className={styles.heroSection}>
        <div className={styles.kraftTagWrapper}>
          <div className={styles.tagString} />
          <div className={styles.kraftTag}>
            <div className={styles.tagHole} />
            付守文非让我
            <br />
            给照片放上来
          </div>
        </div>

        <h1 className={styles.mainTitle}>这有俩人结婚，他们很高兴</h1>
        <p className={styles.subTitle}>
          These two are getting married, and they look super happy!
        </p>

        <svg
          className={styles.arrowLeft}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M90 10 C 60 10, 20 40, 25 80"
            stroke="#333"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path
            d="M15 70 L 25 85 L 35 70"
            stroke="#333"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <svg
          className={styles.arrowRight}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 10 C 40 10, 80 40, 75 80"
            stroke="#333"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <path
            d="M65 70 L 75 85 L 85 70"
            stroke="#333"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </section>

      <section className={styles.gallery}>
        {photos.map((src, index) => (
          <button
            key={src}
            type="button"
            className={styles.polaroidCard}
            onClick={() => setSelectedPhoto(src)}
          >
            {index % 2 === 0 ? (
              <span className={styles.starDecor}>✧</span>
            ) : (
              <span className={styles.starDecorRight}>☆</span>
            )}
            <img src={src} alt={`Wedding ${index + 1}`} loading="lazy" />
          </button>
        ))}
      </section>

      {selectedPhoto && (
        <div className={styles.lightbox} role="presentation" onClick={closeLightbox}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeLightbox}
            aria-label="Close enlarged photo"
          >
            ×
          </button>
          <img
            src={selectedPhoto}
            alt="Enlarged wedding photo"
            className={styles.enlargedImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default HeGotMarriedPage
