'use client'

import { Activity, Layers, FileText, Shield } from 'lucide-react'
import GaugeChart from './GaugeChart'
import type { AnalysisResult as AnalysisResultType } from '@/lib/types'

interface AnalysisResultProps {
  data: AnalysisResultType
}

export default function AnalysisResult({ data }: AnalysisResultProps) {
  return (
    <div className="space-y-6">
      {/* Gauge Chart */}
      <div className="card-medical flex justify-center">
        <GaugeChart value={data.obstrucao_percentual} />
      </div>

      {/* Cards de informação */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-medical min-h-[120px]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Estrutura
            </span>
          </div>
          <p className="text-base font-semibold text-slate-800 leading-snug break-words hyphens-auto">
            {data.estrutura_colapsada}
          </p>
        </div>

        <div className="card-medical min-h-[120px]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <Activity className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Padrão
            </span>
          </div>
          <p className="text-base font-semibold text-slate-800 leading-snug break-words hyphens-auto">
            {data.padrao_colapso}
          </p>
        </div>
      </div>

      {/* Laudo Técnico */}
      <div className="card-medical">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">
            Laudo Técnico Detalhado
          </span>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-slate-700 leading-relaxed">
            {data.analise_clinica}
          </p>
        </div>

        {/* Nível de Confiança */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-500">Nível de Confiança da IA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${data.nivel_confianca}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700">
              {data.nivel_confianca}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
