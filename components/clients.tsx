import Image from "next/image";
import { featuredClients } from "@/lib/clients";
import { Icon } from "@/components/icon";

export function ClientShowcase({ prominent = false }: { prominent?: boolean }) {
  return <section className={`section client-showcase${prominent ? " client-showcase-prominent" : ""}`} aria-labelledby="clients-heading">
    <div className="container">
      <div className="section-heading">
        <div><span className="eyebrow"><span />Commercial clients</span><h2 id="clients-heading">{prominent ? "Commercial clients we serve." : "Businesses That Trust Us"}</h2></div>
        {prominent && <p>Stadium, office, and facility cleaning for the organizations below.</p>}
      </div>
      <div className="client-grid">{featuredClients.map(client => <a key={client.id} className="client-card" href={client.website}>
        <div className="client-logo"><Image src={client.logo.src} alt={`${client.name} logo`} width={client.logo.width} height={client.logo.height} sizes="(max-width: 700px) 220px, 280px" /></div>
        <div className="client-details"><h3>{client.name}</h3><p>{client.service}</p>{client.location && <p className="client-location">{client.location}</p>}<span className="client-website">Visit official website <Icon name="arrow" /></span></div>
      </a>)}</div>
    </div>
  </section>;
}
