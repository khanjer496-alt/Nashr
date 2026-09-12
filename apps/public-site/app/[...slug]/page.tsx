import { notFound } from 'next/navigation';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { pages, directoryPages } from '../../content/pages';
import { GuidePage } from '../../components/guide-page';

export const dynamicParams = false;
export function generateStaticParams() { return [...Object.keys(pages), ...Object.keys(directoryPages)].map(path => ({slug:path.split('/')})); }
export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}) {
  const {slug}=await params; const path=slug.join('/'); const page=pages[path] || directoryPages[path];
  if(!page) return {};
  return {title:`${page.title} | ${brand.name}`, description:page.description, alternates:{canonical:`${brand.appUrl}/${path}`}, openGraph:{title:page.title,description:page.description,url:`${brand.appUrl}/${path}`}};
}
export default async function Page({params}:{params:Promise<{slug:string[]}>}) {
  const {slug}=await params; const path=slug.join('/'); if(!pages[path]&&!directoryPages[path])notFound();
  return <GuidePage slug={path}/>;
}
