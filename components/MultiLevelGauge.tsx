'use client'

import { useEffect, useState } from 'react'
import type { LevelAnalysis } from '@/lib/types'

interface MiniGaugeProps {
  value: number
  label: string
  sublabel: string
  pattern: string
  description: string
}

function MiniGauge({ value, label, sublabel, pattern, description }: MiniGaugeProps) {
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
  const size = 100
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = Math.PI * radius

  const getStrokeDashoffset = (val: number) => {
    return circumference - (val / 100) * circumference
  }

  const pointerRotation = -90 + (animatedValue / 100) * 180

  const getColor = (val: number) => {
    if (val <= 50) return '#22c55e'
    if (val <= 75) return '#f59e0b'
    return '#dc2626'
  }

  const getClassification = (val: number) => {
    if (val <= 25) return { text: 'Leve', color: 'text-green-600', bg: 'bg-green-100' }
    if (val <= 50) return { text: 'Moderada', color: 'text-green-600', bg: 'bg-green-100' }
    if (val <= 75) return { text: 'Significativa', color: 'text-amber-600', bg: 'bg-amber-100' }
    return { text: 'Severa', color: 'text-red-600', bg: 'bg-red-100' }
  }

  const classification = getClassification(value)

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header do nível */}
      <div className="text-center mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        <p className="text-xs text-slate-400">{sublabel}</p>
      </div>

      {/* Mini Gauge SVG */}
      <div className="relative">
        <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
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
            style={{ transition: 'stroke 0.3s ease' }}
          />

          {/* Ponteiro */}
          <g style={{ transform: `rotate(${pointerRotation}deg)`, transformOrigin: `${center}px ${center}px` }}>
            <line
              x1={center}
              y1={center}
              x2={center}
              y2={center - radius + strokeWidth + 4}
              stroke="#1e293b"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>

          {/* Centro do ponteiro */}
          <circle cx={center} cy={center} r={5} fill="#1e293b" />
          <circle cx={center} cy={center} r={2.5} fill="#f8fafc" />

          {/* Marcadores */}
          <text x={4} y={center + 10} fontSize="8" fill="#94a3b8" fontWeight="500">0</text>
          <text x={size - 4} y={center + 10} textAnchor="end" fontSize="8" fill="#94a3b8" fontWeight="500">100</text>
        </svg>
      </div>

      {/* Valor e classificação */}
      <div className="text-center mt-1">
        <p className="text-2xl font-bold text-slate-800">{Math.round(animatedValue)}%</p>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classification.color} ${classification.bg}`}>
          {classification.text}
        </span>
      </div>

      {/* Padrão de colapso */}
      <div className="mt-3 text-center w-full">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Padrão</p>
        <p className="text-sm font-semibold text-slate-700">{pattern}</p>
      </div>

      {/* Descrição */}
      <div className="mt-2 w-full">
        <p className="text-xs text-slate-500 text-center leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}

interface MultiLevelGaugeProps {
  velopalato: LevelAnalysis
  orofaringe: LevelAnalysis
  epiglote: LevelAnalysis
}

export default function MultiLevelGauge({ velopalato, orofaringe, epiglote }: MultiLevelGaugeProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-600 text-center">
        Análise por Nível Anatômico
      </h3>

      {/* Grid responsivo: 1 coluna no mobile, 3 no desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniGauge
          value={velopalato.obstrucao_percentual}
          label="Velo/Palato"
          sublabel="Superior"
          pattern={velopalato.padrao_colapso}
          description={velopalato.descricao}
        />

        <MiniGauge
          value={orofaringe.obstrucao_percentual}
          label="Orofaringe"
          sublabel="Intermediário"
          pattern={orofaringe.padrao_colapso}
          description={orofaringe.descricao}
        />

        <MiniGauge
          value={epiglote.obstrucao_percentual}
          label="Epiglote/Base"
          sublabel="Inferior"
          pattern={epiglote.padrao_colapso}
          description={epiglote.descricao}
        />
      </div>

      {/* Legenda */}
      <div className="flex justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-slate-500">0-50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-500">50-75%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-slate-500">75-100%</span>
        </div>
      </div>
    </div>
  )
}
