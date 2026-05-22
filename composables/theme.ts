export const useTheme = () => {
  const validColors = ['primary', 'purple', 'warning', 'indigo', 'success', 'orange']

  const color = useState('color', () => 'primary')
  const mode = useState('mode', () => 'light')

  const setColor = (mainColor: string) => {
    color.value = validColors.includes(mainColor) ? mainColor : 'primary'

    const root = document.documentElement;
    const shades = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

    shades.forEach((shade) => {
      root.style.setProperty(
        `--primary-${shade}`,
        getComputedStyle(root).getPropertyValue(`--${mainColor}-${shade}`).trim()
      )
    })
  }

  return {
    color,
    mode,
    setColor
  }
}