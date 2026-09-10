import{render,screen}from'@testing-library/react'
import{vi}from'vitest'
vi.mock('./advertising/OwnerBannerPage',()=>({default:()=> <main><h1>Manage your server banner</h1><h2>Manage server listings</h2></main>}))
vi.mock('./config/site',()=>({siteConfig:{bannerUploadsEnabled:true}}))
import RootPage from'./RootPage'
it('routes the dedicated banner and listing workspace',()=>{window.history.pushState({},'','/advertise/banner');render(<RootPage/>);expect(screen.getByRole('heading',{name:'Manage server listings'})).toBeInTheDocument()})
