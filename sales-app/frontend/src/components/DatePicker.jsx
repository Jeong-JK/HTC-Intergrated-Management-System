import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ko } from 'date-fns/locale'
import { inputCls } from './Common.jsx'

export default function DatePicker({ value, onChange, placeholder='날짜 선택' }) {
  const date = value ? new Date(value) : null

  const handleChange = (d) => {
    if (!d) { onChange(null); return }
    const yyyy = d.getFullYear()
    const mm   = String(d.getMonth()+1).padStart(2,'0')
    const dd   = String(d.getDate()).padStart(2,'0')
    onChange(`${yyyy}-${mm}-${dd}`)
  }

  return (
    <ReactDatePicker
      selected={date}
      onChange={handleChange}
      dateFormat="yyyy-MM-dd"
      locale={ko}
      placeholderText={placeholder}
      className={inputCls}
      wrapperClassName="w-full"
      popperPlacement="bottom-start"
    />
  )
}
