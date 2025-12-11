'use client'

import { useEffect, useState } from 'react'

interface GaugeChartProps {
  value: number
  label?: string
}

export default function GaugeChart({ value, label = 'Grau de Obstrução' }: GaugeChartProps) {
  const [animatedValue, setAnimatedValue] = useState(0)

  // Animação suave do valor
  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValue + (value - startValue) * easeOut

      setAnimatedValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  // Configurações do gauge
  const size = 240
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const center = size / 2

  // Arco de 180 graus (semicírculo)
  const startAngle = 180
  const angleRange = 180

  // Calcular o ângulo atual baseado no valor
  const currentAngle = startAngle - (animatedValue / 100) * angleRange

  // Converter ângulos para coordenadas
  const polarToCartesian = (angle: number) => {
    const angleInRadians = (angle * Math.PI) / 180
    return {
      x: center + radius * Math.cos(angleInRadians),
      y: center - radius * Math.sin(angleInRadians),
    }
  }

  // Path do arco de valor (segmentado por cores)
  const createArcPath = (start: number, end: number) => {
    const startP = polarToCartesian(startAngle - (start / 100) * angleRange)
    const endP = polarToCartesian(startAngle - (end / 100) * angleRange)
    const largeArc = end - start > 50 ? 1 : 0
    return `M ${startP.x} ${startP.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endP.x} ${endP.y}`
  }

  // Determinar cor baseada no valor
  const getColor = (val: number) => {
    if (val <= 50) return '#22c55e' // Verde
    if (val <= 75) return '#f59e0b' // Amarelo/Laranja
    return '#dc2626' // Vermelho
  }

  // Criar segmentos de cor
  const segments = [
    { start: 0, end: 50, color: '#dcfce7' },
    { start: 50, end: 75, color: '#fef3c7' },
    { start: 75, end: 100, color: '#fee2e2' },
  ]

  // Determinar classificação
  const getClassification = (val: number) => {
    if (val <= 25) return { text: 'Leve', color: 'text-green-600' }
    if (val <= 50) return { text: 'Moderada', color: 'text-green-600' }
    if (val <= 75) return { text: 'Significativa', color: 'text-amber-600' }
    return { text: 'Severa', color: 'text-red-600' }
  }

  const classification = getClassification(value)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
        {/* Segmentos de fundo coloridos */}
        {segments.map((segment, index) => (
          <path
            key={index}
            d={createArcPath(segment.start, segment.end)}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ))}

        {/* Arco de valor */}
        {animatedValue > 0 && (
          <path
            d={createArcPath(0, Math.min(animatedValue, 100))}
            fill="none"
            stroke={getColor(animatedValue)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
            }}
          />
        )}

        {/* Ponteiro */}
        <g transform={`rotate(${-currentAngle + 90}, ${center}, ${center})`}>
          <polygon
            points={`${center},${center - radius + strokeWidth + 5} ${center - 6},${center} ${center + 6},${center}`}
            fill="#1e293b"
          />
        </g>

        {/* Centro do ponteiro */}
        <circle cx={center} cy={center} r={12} fill="#1e293b" />
        <circle cx={center} cy={center} r={8} fill="#f8fafc" />

        {/* Valor numérico */}
        <text
          x={center}
          y={center + 35}
          textAnchor="middle"
          className="text-3xl font-bold"
          fill="#1e293b"
        >
          {Math.round(animatedValue)}%
        </text>

        {/* Marcadores */}
        <text x={20} y={center + 15} textAnchor="start" fontSize="12" fill="#64748b">0</text>
        <text x={center} y={25} textAnchor="middle" fontSize="12" fill="#64748b">50</text>
        <text x={size - 20} y={center + 15} textAnchor="end" fontSize="12" fill="#64748b">100</text>
      </svg>

      {/* Label */}
      <div className="text-center -mt-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className={`text-lg font-semibold ${classification.color}`}>
          {classification.text}
        </p>
      </div>
    </div>
  )
}
