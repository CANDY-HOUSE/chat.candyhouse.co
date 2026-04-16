import { TooltipButton } from '@/components/TooltipButton'
import { HorizontalCollapse } from '@/features/common/HorizontalCollapse'
import { editorExpandedAtom, isShowSideBarAtom } from '@/store'
import ShrinkIcon from '@mui/icons-material/CloseFullscreen'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandIcon from '@mui/icons-material/OpenInFull'
import SendIcon from '@mui/icons-material/Send'
import { IconButton } from '@mui/material'
import { useAtom, useSetAtom } from 'jotai'
import React, { forwardRef, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  fileFn: (files: File[]) => void // 上传文件回调
  validateFile: (file: File) => boolean // 验证文件
  disableSend: boolean // 是否禁用发送按钮
  embed?: boolean // 是否嵌套
  style?: Record<string, string>
}

const Toolbar = forwardRef<HTMLDivElement, Props>(
  ({ fileFn, validateFile, disableSend, embed, style }, ref) => {
    const { t } = useTranslation()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const setIsShowSideBar = useSetAtom(isShowSideBarAtom)
    const [editorExpanded, setEditorExpanded] = useAtom(editorExpandedAtom)

    const leftToolsMap = [
      {
        type: 'expand',
        icon: <MenuIcon sx={{ fontSize: 'var(--icon-size-small)' }} />,
        tooltip: t('fullscreen'),
        hide: embed
      },
      {
        type: 'file',
        icon: <FolderOutlinedIcon sx={{ fontSize: 'var(--icon-size-small)' }} />,
        tooltip: t('openFile')
      }
    ].filter((group) => !group.hide)

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        const isValid = files.every((file) => validateFile(file))

        if (isValid) {
          fileFn(files)
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        e.target.value = ''
      },
      [validateFile, fileFn]
    )

    const leftToolClick = useCallback(
      (type: string) => {
        switch (type) {
          case 'expand':
            setIsShowSideBar((value) => !value)
            return
          case 'file':
            fileInputRef.current?.click()
            return
        }
      },
      [setIsShowSideBar]
    )

    const toggleEditorExpand = useCallback(() => {
      setEditorExpanded(!editorExpanded)
    }, [editorExpanded, setEditorExpanded])

    return (
      <div id="toolbar" ref={ref} style={{ ...style }}>
        <div className="left-block">
          {leftToolsMap.map((config) => {
            return (
              <TooltipButton
                key={config.type}
                onClick={() => leftToolClick(config.type)}
                tooltip={config.tooltip}
                icon={config.icon}
              />
            )
          })}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="*/*"
          />
        </div>

        <div className="right-block">
          <HorizontalCollapse
            togglePosition="end"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
              gap: 0
            }}
          >
            <button className="ql-bold"></button>
            <button className="ql-strike"></button>
            <button className="ql-italic"></button>
            <button className="ql-underline"></button>
            <button className="ql-list" value="ordered"></button>
            <button className="ql-list" value="bullet"></button>
            <button className="ql-blockquote"></button>
            <button className="ql-code-block"></button>
            <button className="ql-link"></button>
          </HorizontalCollapse>

          <button className="ql-clean"></button>

          {!embed && (
            <>
              <IconButton onClick={toggleEditorExpand}>
                {!editorExpanded ? (
                  <ExpandIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
                ) : (
                  <ShrinkIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
                )}
              </IconButton>
              <IconButton className="ql-sendMsg" disabled={disableSend}>
                <SendIcon sx={{ fontSize: 'var(--icon-size-small)' }} />
              </IconButton>
            </>
          )}
        </div>
      </div>
    )
  }
)

export default React.memo(Toolbar)
