import styles from '../QdiiMonitor.module.css'

/** 免责声明：美国主表与世界视野页脚共用 */
export default function Disclaimer() {
  return (
    <p className={styles.disclaimer}>
      基金数据来自公开网络整理，仅供学习参考，不构成投资建议或基金推荐；实际额度与状态以基金公司官方披露为准，投资有风险，决策需谨慎。
    </p>
  )
}
