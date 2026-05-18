import { useState } from 'react'
import { createPortal } from 'react-dom'
import ProjectMockup from '../../../components/mockups/ProjectMockup'
import styles from '../ProjectDetail.module.css'

const STEPS = [
  {
    text: (
      <>
        点击下方「开始下载」，下载完成后<strong>解压</strong>压缩包，得到一个文件夹。
      </>
    ),
  },
  {
    text: (
      <>
        打开 Chrome，在地址栏输入 <code>chrome://extensions</code> 并回车。
      </>
    ),
  },
  {
    text: (
      <>
        开启右上角的<strong>「开发者模式」</strong>开关。
      </>
    ),
  },
  {
    text: (
      <>
        点击左上角<strong>「加载已解压的扩展程序」</strong>，选择刚才解压的文件夹即可完成安装。
      </>
    ),
  },
]

function InstallModal({ downloadUrl, onClose }) {
  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>📦 如何手动安装扩展</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalSteps}>
          {STEPS.map((step, i) => (
            <div key={i} className={styles.modalStep}>
              <span className={styles.modalStepNum}>{i + 1}</span>
              <p className={styles.modalStepText}>{step.text}</p>
            </div>
          ))}
        </div>

        <div className={styles.modalFooter}>
          <a
            href={downloadUrl}
            download
            className={`${styles.dlBtn} ${styles.primary}`}
            onClick={onClose}
          >
            ↓ 开始下载
          </a>
          <button
            className={`${styles.dlBtn} ${styles.secondary}`}
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DetailHero({ project }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <section className={styles.detailHero}>
      <div className={styles.detailHeroInner}>
        <div className={styles.detailHeroText}>
          <span className="section-label fi d1">Project</span>
          <h1 className={`${styles.detailName} fi d2`}>{project.title}</h1>
          <p className={`${styles.detailTagline} fi d3`}>{project.tagline}</p>
          {project.badge && (
            <span className={`${styles.detailBadge} fi d4`}>⭐ {project.badge}</span>
          )}
          <p className={`${styles.detailDesc} fi d4`}>{project.detailDescription}</p>
          <div className={`${styles.heroActions} fi d5`}>
            <a
              href={project.links.project}
              className={`${styles.dlBtn} ${styles.primary}`}
              target="_blank"
              rel="noreferrer"
            >
              {project.ctaLabel ?? '前往 Chrome 商店安装'}{' '}
              <span className={styles.linkArrow}>↗</span>
            </a>
            {project.links.download && (
              <button
                className={`${styles.dlBtn} ${styles.accent}`}
                onClick={() => setShowModal(true)}
              >
                ↓ 离线下载
              </button>
            )}
          </div>
          {project.id === 'yessir' && (
            <div className={`${styles.sciNote} fi d5`}>前往 Google Chrome 商店需科学上网</div>
          )}
        </div>

        <div className={`${styles.detailHeroVisual} fi d6`}>
          <div className={styles.detailVisualMockup}>
            <ProjectMockup type={project.mockupType} />
          </div>
        </div>
      </div>

      {showModal && (
        <InstallModal
          downloadUrl={project.links.download}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  )
}

export default DetailHero
