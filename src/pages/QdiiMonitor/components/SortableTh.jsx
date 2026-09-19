import styles from './FundTable.module.css'

function SortDirectionIcon({ direction }) {
  return (
    <svg
      className={`${styles.sortIcon} ${direction === 'desc' ? styles.sortIconDown : ''}`}
      viewBox="0 0 1024 1024"
      aria-hidden="true"
    >
      <path
        d="M547.328 296.661333l207.786667 200.448a17.578667 17.578667 0 0 0 24.405333 0l25.941333-25.173333a17.066667 17.066667 0 0 0 0-24.576l-281.258666-271.786667a17.578667 17.578667 0 0 0-24.405334 0l-281.258666 271.786667a17.066667 17.066667 0 0 0 0 24.576l25.941333 25.173333a17.578667 17.578667 0 0 0 24.448 0l207.786667-200.448v539.434667c0 9.514667 7.765333 17.237333 17.408 17.237333h35.754666c9.642667 0 17.450667-7.68 17.450667-17.237333V296.661333z"
        stroke="currentColor"
        strokeWidth="44"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SortIdleIcon() {
  return (
    <svg className={styles.sortIconIdle} viewBox="0 0 1024 1024" aria-hidden="true">
      <path d="M407.568 154.019c-11.952-11.925-26.904-17.894-41.853-17.894-5.972 0-11.952 2.984-17.929 2.984h-2.992c-8.964 5.961-14.94 11.941-20.921 17.902L81.77 398.634c-23.912 23.862-23.912 59.669 0 80.551 11.956 11.929 26.901 17.894 41.841 17.894 14.948 0 29.896-5.965 41.845-17.894l146.459-146.177v495.198c0 32.815 26.908 56.677 56.797 56.677 29.892 0 56.789-26.854 56.789-56.677V198.775c-0.001-14.925-5.973-32.819-17.933-44.756zM942.59 541.831c-11.956-11.941-26.904-17.905-41.849-17.905-14.944 0-29.889 5.965-41.845 17.905L709.45 690.977V195.791c0-32.819-26.901-56.681-56.785-56.681-29.892 0-56.797 26.85-56.797 56.681v635.391c0 32.811 26.904 56.693 56.797 56.693 14.944 0 29.885-5.98 41.841-17.905l245.097-244.615c26.896-23.859 26.896-59.658 2.987-83.524z" />
    </svg>
  )
}

// 可排序表头：与 FundTable 共用同一套按钮与图标样式
export default function SortableTh({ label, active, direction, onSort }) {
  const ascending = active && direction === 'asc'
  const nextDirection = active && direction === 'desc' ? '从低到高' : '从高到低'

  return (
    <th aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`${styles.sortButton} ${active ? styles.sortButtonActive : ''}`}
        onClick={onSort}
        aria-label={`${label}，点击按${nextDirection}排序`}
      >
        <span>{label}</span>
        {active ? <SortDirectionIcon direction={direction} /> : <SortIdleIcon />}
      </button>
    </th>
  )
}
