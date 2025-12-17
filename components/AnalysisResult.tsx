'use client'

import { FileText, Shield } from 'lucide-react'
import MultiLevelGauge from './MultiLevelGauge'
import type { AnalysisResult as AnalysisResultType } from '@/lib/types'

interface AnalysisResultProps {
  data: AnalysisResultType
}

export default function AnalysisResult({ data }: AnalysisResultProps) {
  // Calcular obstrução máxima para destaque
  const maxObstrucao = Math.max(
    data.velo_palato.obstrucao_percentual,
    data.orofaringe.obstrucao_percentual,
    data.epiglote_base_lingua.obstrucao_percentual
  )

  const getNivelMaisAfetado = () => {
    if (data.velo_palato.obstrucao_percentual === maxObstrucao) return 'Velo/Palato'
    if (data.orofaringe.obstrucao_percentual === maxObstrucao) return 'Orofaringe'
    return 'Epiglote/Base de Língua'
  }

  return (
    <div className="space-y-6">
      {/* Multi-Level Gauge Charts */}
      <div className="card-medical">
        <MultiLevelGauge
          velopalato={data.velo_palato}
          orofaringe={data.orofaringe}
          epiglote={data.epiglote_base_lingua}
        />
      </div>

      {/* Resumo Rápido */}
      <div className="card-medical bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Obstrução Máxima</p>
            <p className="text-3xl font-bold text-slate-800">{maxObstrucao}%</p>
            <p className="text-sm text-slate-600 mt-1">
              Nível mais afetado: <span className="font-semibold">{getNivelMaisAfetado()}</span>
            </p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            maxObstrucao <= 50 ? 'bg-green-100' :
            maxObstrucao <= 75 ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            <span className={`text-2xl font-bold ${
              maxObstrucao <= 50 ? 'text-green-600' :
              maxObstrucao <= 75 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {maxObstrucao <= 50 ? '!' : maxObstrucao <= 75 ? '!!' : '!!!'}
            </span>
          </div>
        </div>
      </div>

      {/* Laudo Técnico */}
      <div className="card-medical">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">
            Laudo Técnico Integrado
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
            <span className="text-sm text-slate-500">Nível de Confiança</span>
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
