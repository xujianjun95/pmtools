import MockupKada from './MockupKada'
import MockupYesSir from './MockupYesSir'
import MockupDangAnalysis from './MockupDangAnalysis'

function ProjectMockup({ type }) {
  if (type === 'kada') return <MockupKada />
  if (type === 'dang-analysis') return <MockupDangAnalysis />
  return <MockupYesSir />
}

export default ProjectMockup
