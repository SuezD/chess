import React from 'react'

type Props = {
  explanation: string
  bestMove?: string
  onRetry: () => void
  onShow: () => void
  onContinue: () => void
}

export default function MistakeModal({ explanation, bestMove, onRetry, onShow, onContinue }: Props) {
  return (
    <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)'}}>
      <div style={{background:'#fff',color:'#000',padding:18,borderRadius:8,maxWidth:360}}>
        <h3>⚠️ Pause</h3>
        <p>Your move was legal, but there was a problem.</p>
        <p>{explanation}</p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
          <button onClick={onRetry}>Retry move</button>
          <button onClick={onShow}>Show explanation</button>
          <button onClick={onContinue}>Continue</button>
        </div>
      </div>
    </div>
  )
}
