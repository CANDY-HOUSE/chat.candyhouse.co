import type { ModelProvider } from '@/types/ai'

const getModelProvider = (modelName: string) => {
  const lowerCaseModelName = modelName.toLowerCase()

  // 各公司模型前缀映射
  const companyPrefixes: Record<string, ModelProvider> = {
    gpt: 'OpenAI',
    sora: 'OpenAI',
    claude: 'Anthropic',
    gemini: 'Google',
    veo: 'Google',
    grok: 'xAI',
    deepseek: 'Deepseek'
  }

  for (const [prefix, company] of Object.entries(companyPrefixes)) {
    if (lowerCaseModelName.includes(prefix)) {
      return company
    }
  }

  throw new Error(`Unknown model: ${modelName}`)
}

const supportsVideoGeneration = (modelName: string): boolean => {
  const modelProvider = getModelProvider(modelName)

  switch (modelProvider) {
    case 'OpenAI':
      return modelName.startsWith('sora')
    case 'Google':
      return modelName.startsWith('veo')
    default:
      return false
  }
}

const supportsImageGeneration = (modelName: string): boolean => {
  const modelProvider = getModelProvider(modelName)

  switch (modelProvider) {
    case 'OpenAI':
      return modelName.startsWith('gpt-5')
    case 'Google':
      return modelName.includes('image')
    default:
      return false
  }
}

const supportsResponseAPI = (modelName: string): boolean => {
  const modelProvider = getModelProvider(modelName)

  switch (modelProvider) {
    case 'OpenAI':
    case 'xAI':
      return true
    default:
      return false
  }
}

export const ai = {
  getModelProvider,
  supportsVideoGeneration,
  supportsImageGeneration,
  supportsResponseAPI
}
