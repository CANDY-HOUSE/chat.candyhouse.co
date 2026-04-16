import { ai } from '@/utils'
import { ReactComponent as SvgClaude } from '@assets/svg/claude.svg'
import { ReactComponent as SvgDeepseek } from '@assets/svg/deepseek.svg'
import { ReactComponent as SvgGoogle } from '@assets/svg/google.svg'
import { ReactComponent as SvgGrok } from '@assets/svg/grok.svg'
import { ReactComponent as SvgOpenAi } from '@assets/svg/openai.svg'
import PersonIcon from '@mui/icons-material/Person'
import { SvgIcon } from '@mui/material'
import Avatar from '@mui/material/Avatar'
import { useTheme } from '@mui/material/styles'
import React from 'react'

interface Props {
  role: string
  model?: string
}

export const AiAvatarIcon: React.FC<Props> = ({ role, model }) => {
  const theme = useTheme()
  const avatarStyles = { width: '2rem', height: '2rem' }

  const svgIconFrom = (model?: string): React.FunctionComponent<React.SVGProps<SVGSVGElement>> => {
    if (!model) return SvgOpenAi

    switch (ai.getModelProvider(model)) {
      case 'Deepseek':
        return SvgDeepseek
      case 'Google':
        return SvgGoogle
      case 'Anthropic':
        return SvgClaude
      case 'xAI':
        return SvgGrok
      default:
        return SvgOpenAi
    }
  }

  if (role === 'assistant') {
    return (
      <Avatar sx={avatarStyles}>
        <SvgIcon
          component={svgIconFrom(model)}
          inheritViewBox
          htmlColor={theme.palette.text.primary}
        />
      </Avatar>
    )
  }

  return (
    <Avatar sx={avatarStyles}>
      <PersonIcon htmlColor={theme.palette.text.primary} />
    </Avatar>
  )
}
