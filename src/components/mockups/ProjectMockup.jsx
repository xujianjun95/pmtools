import MockupKada from './MockupKada'
import MockupYesSir from './MockupYesSir'
import MockupDangAnalysis from './MockupDangAnalysis'

function ProjectMockup({ type, isActive = false }) {
  if (type === 'kada') return <MockupKada isActive={isActive} />
  if (type === 'dang-analysis') return <MockupDangAnalysis isActive={isActive} />
  return <MockupYesSir isActive={isActive} />
}

export default ProjectMockup
