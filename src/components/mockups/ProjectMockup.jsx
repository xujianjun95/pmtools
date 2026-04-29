import MockupKada from './MockupKada'
import MockupYesSir from './MockupYesSir'

function ProjectMockup({ type }) {
  if (type === 'kada') return <MockupKada />
  return <MockupYesSir />
}

export default ProjectMockup
