import { useConversation } from '@/hooks/useConversation'
import { devtoolVisibleAtom, realtimStatusAtom, switchToast, viewTypeAtom } from '@/store'
import { type IMessage } from '@/types/messagetypes'
import { apiPostRealtimeSession } from '@api'
import { Level, MessageState, ViewModel } from '@constants'
import MicIcon from '@mui/icons-material/Mic'
import { IconButton } from '@mui/material'
import { chat, logger } from '@utils'
import { useAtom, useSetAtom } from 'jotai'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import RealtimeDevtool from './RealtimeDevtool'

const RECORD_TIMEOUT = 30000

interface Props {
  conversationId: string
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLElement>
}

export interface RealtimeAudioRef {
  startSession: () => Promise<void>
  stopSession: () => Promise<void>
}

const RealtimeAudio = forwardRef<RealtimeAudioRef, Props>(
  ({ conversationId, disabled = false, onClick }, ref) => {
    const [viewType, setViewType] = useAtom(viewTypeAtom)
    const setRealtimStatus = useSetAtom(realtimStatusAtom)
    const [devtoolVisible, setDevtoolVisible] = useAtom(devtoolVisibleAtom)

    const [isSessionActive, setIsSessionActive] = useState(false)
    const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
    const [realtimeStatusArr, setRealtimeStatusArr] = useState<Array<string>>([])

    const peerConnection = useRef<RTCPeerConnection>(null) // WebRTC 连接
    const audioElement = useRef<HTMLAudioElement>(null) // 音频播放 dom
    const mediaRecorder = useRef<MediaRecorder>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const stopRecordTimerIdRef = useRef<ReturnType<typeof setTimeout>>(null) // 停止 realtime 模式倒计时
    const prevViewTypeRef = useRef<ViewModel>(viewType) // 视图状态改变前的状态

    const { getAttrValue, pushMessage, updateModelInfo } = useConversation()

    // 开始会话
    const startSession = async () => {
      // 改变视图
      setViewType(ViewModel.voice)

      try {
        // 获取 session
        const modelInfo = getAttrValue(conversationId, 'modelInfo')

        const data = await apiPostRealtimeSession('gpt-realtime', modelInfo?.jsonConfig)
        if (!data) return
        const EPHEMERAL_KEY = data.client_secret.value
        // 创建RTCPeerConnection对象
        const pc = new RTCPeerConnection()
        // 监听音频流的到来
        audioElement.current = document.createElement('audio')
        // 播放音频流
        audioElement.current.autoplay = true
        pc.ontrack = (e) => {
          if (!audioElement.current) return
          audioElement.current.srcObject = e.streams[0] ?? null
        }
        // 获取录音权限
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: true
        })

        const track = ms.getTracks()[0]
        if (track) {
          pc.addTrack(track)
        } else {
          logger.warn('Failed to get audio track')
        }

        mediaStreamRef.current = ms
        mediaRecorder.current = new MediaRecorder(ms, {
          mimeType: 'audio/webm'
        })

        const dc = pc.createDataChannel('oai-events')
        setDataChannel(dc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const baseUrl = 'https://api.openai.com/v1/realtime'
        const sdpResponse = await fetch(`${baseUrl}?model=gpt-realtime`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            'Content-Type': 'application/sdp'
          }
        })

        const answer: RTCSessionDescriptionInit = {
          type: 'answer',
          sdp: await sdpResponse.text()
        }
        // 设置远程描述
        await pc.setRemoteDescription(answer)

        peerConnection.current = pc

        setViewType(ViewModel.voiceActive)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        switchToast({ visible: true, message: errMsg, level: Level.error })
      }
    }

    // 停止会话
    const stopSession = useCallback(() => {
      return new Promise<void>((resolve) => {
        // 还原视图
        setViewType(ViewModel.normal)

        if (dataChannel) {
          dataChannel.close()
        }

        peerConnection.current?.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop()
          }
        })

        if (peerConnection.current) {
          peerConnection.current.close()
        }

        setIsSessionActive(false)
        setDataChannel(null)
        mediaStreamRef.current = null
        mediaRecorder.current = null
        audioElement.current = null
        peerConnection.current = null
        stopRecordTimerIdRef.current = null
        setRealtimeStatusArr([])
        setDevtoolVisible(false)

        resolve()
      })
    }, [dataChannel, setDevtoolVisible, setViewType])

    // 暂停音频输入
    const pauseRecording = () => {
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        try {
          mediaRecorder.current.pause()
        } catch (error) {
          logger.error('Error pausing recorder:', error)
        }
      }
      const stream = mediaStreamRef.current
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false
        })
      }
    }

    // 恢复音频输入
    const resumeRecording = () => {
      const stream = mediaStreamRef.current
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true
        })
      }

      const recorderState = mediaRecorder.current?.state
      if (mediaRecorder.current && recorderState === 'paused') {
        try {
          mediaRecorder.current.resume()
        } catch (error) {
          logger.error('Error resuming recorder:', error)
        }
      } else if (mediaRecorder.current && recorderState === 'inactive') {
        try {
          mediaRecorder.current.start()
        } catch (error) {
          logger.error('Error restarting recorder:', error)
        }
      }
    }

    // 停止音频录制
    const stopRecording = () => {
      const recorder = mediaRecorder.current
      const state = recorder?.state
      if (recorder && (state === 'recording' || state === 'paused')) {
        try {
          recorder.stop()
        } catch (error) {
          logger.error('Error stopping recorder:', error)
        }
      }
    }

    useImperativeHandle(ref, () => ({
      startSession,
      stopSession
    }))

    // 监听setViewType
    useEffect(() => {
      if (viewType === ViewModel.voice) return
      switch (viewType) {
        case ViewModel.normal:
          // 停止会话
          stopSession()
          break
        case ViewModel.voiceActive:
          // 恢复 会话
          prevViewTypeRef.current === ViewModel.voicePause && resumeRecording()
          break
        case ViewModel.voicePause:
          // 暂停会话
          pauseRecording()
          break
      }

      prevViewTypeRef.current = viewType
    }, [stopSession, viewType])

    // 监听dataChannel
    useEffect(() => {
      if (!dataChannel) return

      let modelTextRes = '' // 模型回答的文本
      let modelMsgRes: IMessage | null = null // 模型回答的消息体
      let userTranscriptionTextRes = '' // 用户音频转录的文本
      let userTranscriptionRes: IMessage | null = null // 用户音频转录的消息体

      dataChannel.addEventListener('message', async (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setRealtimStatus(data.type)
        setRealtimeStatusArr((prev) => {
          return [...prev, data.type]
        })
        // input_audio_buffer.speech_started: 语音输入开始
        // input_audio_buffer.speech_stopped: 语音输入结束
        // input_audio_buffer.stopped: 对话结束最后一个事件
        // conversation.item.input_audio_transcription.delta: 当输入的音频转录内容部分的文本值更新时
        // conversation.item.input_audio_transcription.completed: 当输入的音频转录内容完成时
        if (data.type === 'response.audio_transcript.done') {
          // 模型回答结束
          modelMsgRes!.state = MessageState.finish
          modelMsgRes!.content = [chat.createContentBlock(data.transcript)]
          pushMessage(conversationId, modelMsgRes!)

          // reset
          modelTextRes = ''
          modelMsgRes = null

          if (stopRecordTimerIdRef.current) {
            clearTimeout(stopRecordTimerIdRef.current)
          } else {
            stopRecordTimerIdRef.current = setTimeout(() => {
              stopSession()
            }, RECORD_TIMEOUT)
          }
        } else if (data.type === 'response.audio_transcript.delta') {
          // 模型回答中间结果
          if (!modelMsgRes) {
            updateModelInfo(conversationId, { atWork: true })
            modelMsgRes = chat.createTplMsg('gpt-realtime', 'assistant')
          }
          modelTextRes += data.delta || ''
          modelMsgRes.state = MessageState.start
          modelMsgRes.content = [chat.createContentBlock(modelTextRes)]
          pushMessage(conversationId, modelMsgRes!, { isEnd: false })
        } else if (data.type === 'input_audio_buffer.speech_started') {
          // 语音输入开始
          resumeRecording()

          userTranscriptionRes = chat.createTplMsg('gpt-realtime', 'user')
          pushMessage(conversationId, userTranscriptionRes, { isEnd: false })
        } else if (data.type === 'conversation.item.input_audio_transcription.delta') {
          // 输入的音频转录中间结果
          if (!userTranscriptionRes) {
            updateModelInfo(conversationId, { atWork: true })
            userTranscriptionRes = chat.createTplMsg('gpt-realtime', 'user')
          }
          userTranscriptionTextRes += data.delta || ''
          userTranscriptionRes.state = MessageState.start
          userTranscriptionRes.content = [chat.createContentBlock(userTranscriptionTextRes)]
          pushMessage(conversationId, userTranscriptionRes, { isEnd: false })
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // 输入的音频转录内容完成
          userTranscriptionRes!.state = MessageState.finish
          userTranscriptionRes!.content = [chat.createContentBlock(data.transcript)]
          pushMessage(conversationId, userTranscriptionRes!)

          // reset
          userTranscriptionTextRes = ''
          userTranscriptionRes = null
        } else if (data.type === 'input_audio_buffer.speech_stopped') {
          // 语音输入结束
          stopRecording()
        }
      })

      dataChannel.addEventListener('open', () => {
        setIsSessionActive(true)
      })
    }, [dataChannel])

    return (
      <>
        <IconButton onClick={onClick} disabled={disabled || isSessionActive}>
          <MicIcon sx={{ fontSize: 'var(--icon-size)' }} />
        </IconButton>

        <RealtimeDevtool visible={devtoolVisible} statusArr={realtimeStatusArr}></RealtimeDevtool>
      </>
    )
  }
)

export default React.memo(RealtimeAudio)
