'use client'

import { useEffect, useState } from 'react'

interface GaugeChartProps {
  value: number
  label?: string
}

export default function GaugeChart({ value, label = 'Grau de Obstrução' }: GaugeChartProps) {
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setAnimatedValue(easeOut * value)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  // Configurações do gauge
  const size = 200
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const center = size / 2

  // Circunferência do semicírculo
  const circumference = Math.PI * radius

  // Calcular o offset baseado no valor (0-100)
  const getStrokeDashoffset = (val: number) => {
    return circumference - (val / 100) * circumference
  }

  // Rotação do ponteiro (de -90 a 90 graus)
  const pointerRotation = -90 + (animatedValue / 100) * 180

  // Determinar cor baseada no valor
  const getColor = (val: number) => {
    if (val <= 50) return '#22c55e'
    if (val <= 75) return '#f59e0b'
    return '#dc2626'
  }

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
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Segmento Verde (0-50%) */}
        <path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${center} ${strokeWidth / 2}`}
          fill="none"
          stroke="#dcfce7"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Segmento Amarelo (50-75%) */}
        <path
          d={`M ${center} ${strokeWidth / 2} A ${radius} ${radius} 0 0 1 ${center + radius * Math.cos(Math.PI / 4)} ${center - radius * Math.sin(Math.PI / 4)}`}
          fill="none"
          stroke="#fef3c7"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
        />

        {/* Segmento Vermelho (75-100%) */}
        <path
          d={`M ${center + radius * Math.cos(Math.PI / 4)} ${center - radius * Math.sin(Math.PI / 4)} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke="#fee2e2"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Arco de progresso */}
        <path
          d={`M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`}
          fill="none"
          stroke={getColor(animatedValue)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={getStrokeDashoffset(animatedValue)}
          style={{
            transition: 'stroke 0.3s ease',
          }}
        />

        {/* Ponteiro */}
        <g style={{ transform: `rotate(${pointerRotation}deg)`, transformOrigin: `${center}px ${center}px` }}>
          <line
            x1={center}
            y1={center}
            x2={center}
            y2={center - radius + strokeWidth + 8}
            stroke="#1e293b"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>

        {/* Centro do ponteiro */}
        <circle cx={center} cy={center} r={10} fill="#1e293b" />
        <circle cx={center} cy={center} r={6} fill="#f8fafc" />

        {/* Marcadores */}
        <text x={12} y={center + 18} fontSize="11" fill="#64748b" fontWeight="500">0</text>
        <text x={center} y={18} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">50</text>
        <text x={size - 12} y={center + 18} textAnchor="end" fontSize="11" fill="#64748b" fontWeight="500">100</text>
      </svg>

      {/* Valor e Label */}
      <div className="text-center -mt-1">
        <p className="text-4xl font-bold text-slate-800">{Math.round(animatedValue)}%</p>
        <p className="text-sm text-slate-500 mt-1">{label}</p>
        <p className={`text-lg font-semibold ${classification.color}`}>
          {classification.text}
        </p>
      </div>
    </div>
  )
}
