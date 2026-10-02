import StockPage from '../../components/StockPage.jsx'
const CATS = ["Adapter Board Cable","Adapters","Antenna Cable","Battery","Brackets","Cables","Cameras","Encoder","Headset","Juggernaut","LAN","Other","Prism","PTT","RS232","SC42/44 OEM Cable","Adapter Board","Adapter Board 자재","SL52 OEM 자재","Mast"]
export default function StockAccessory() { return <StockPage itemType="악세사리" categories={CATS} showQuantity={true}/> }
