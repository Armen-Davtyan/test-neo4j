import dynamic from "next/dynamic";
import { useQuery, useLazyQuery, gql } from "@apollo/client";
import { useState } from "react";
import _ from "lodash";
import styles from '../styles/Home.module.css'
  


const mostRecentQuery = gql`
  {
    articles(options: { limit: 5, sort: { created: DESC } }) {
      __typename
      id
      title
      created
      url
      user {
        __typename
        username
        avatar
      }
    }
  }
`;



const moreArticlesQuery = gql`
  query articlesByTag {
    articles(
      options: { limit: 10, sort: { created: DESC } }
    ) {
      __typename
      id
      title
      created
      url
   
      user {
        __typename
        username
        avatar
      }
    }
  }
`;

const searchInfo = gql`
query Articles($title_CONTAINS: String) {
  articles(where: { title_CONTAINS : $title_CONTAINS }) {
    __typename
    id
    title
    created
    url
    user {
      __typename
      username
      avatar
    }
  }
}
`;


const NoSSRForceGraph = dynamic(() => import("../lib/NoSSRForceGraph"), {
  ssr: false,
});


const formatData = (data) => {
  const nodes = [];
  const links = [];
  if (!data.articles) {
    return { nodes, links };
  }

  data.articles.forEach((a) => {
    nodes.push({
      id: a.id,
      url: a.url,
      __typename: a.__typename,
      title: a.title,
    });

    nodes.push({
      id: a.user.username,
      avatar: a.user.avatar,
      __typename: a.user.__typename,
    });

    links.push({
      source: a.user.username,
      target: a.id,
    });
  });

  return {
    nodes: _.uniqBy(nodes, "id"),
    links,
  };
};

export default function Home() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [searchFilter, setSearchFilter] = useState('');
 
  console.log(graphData)

  const [executeSearch, {data: searchData}] = useLazyQuery(
    searchInfo
  );
  console.log(searchData)

  const { data } = useQuery(mostRecentQuery, {
    onCompleted: (data) => setGraphData(formatData(data)),
  });

  let promis = searchFilter === ""


  const [loadMoreArticles, { called, loading, data: newData }] = useLazyQuery(
    moreArticlesQuery,
    {
      onCompleted: (data) => {
        const newSubgraph = formatData(data);
        setGraphData({
          nodes: _.uniqBy([...graphData.nodes, ...newSubgraph.nodes], "id"),
          links: [...graphData.links, ...newSubgraph.links],
        });
      },
    }
  );

  return (
    <>
    <div className={styles.search_wrapper}>
     <input
      className={styles.input}
      placeholder='Search nodes ...'
      onChange={(e) => setSearchFilter(e.target.value)}
       />
     <button 
       className={styles.search}
       onClick={
         
        () =>executeSearch({variables:{title_CONTAINS: searchFilter}}) 
      }

     >search</button>
    </div>
    <NoSSRForceGraph
      nodeAutoColorBy={"__typename"}
      nodeLabel={"id"}
      graphData={graphData} 
      linkDirectionalParticles="value"
      linkDirectionalArrowLength={8}
      nodeCanvasObjectMode={() => "after"}
      onNodeClick={(node, event) => {
        console.log(node);
        if (node.__typename === "Tag") {
          loadMoreArticles({ variables: { tag: node.id } });
        } else if (node.__typename === "Article") {
          window.open(node.url, "_blank");
        }
      }}
      onNodeDragEnd={(node) => {
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
      }}
      nodeCanvasObject={(node, ctx, globalScale) => {
        if (node.__typename === "Tag" || node.__typename === "Article") {
          const label = node.title || node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2
          );
          ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = node.color;
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions;
        } else if (node.__typename === "User") {
          // TODO: draw image
          const size = 30;
          const img = new Image();
          img.src = node.avatar;
          ctx.drawImage(img, node.x - size /4 , node.y - size /4 , size, size);
        }
      }}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color;
        const bckgDimensions = node.__bckgDimensions;
        bckgDimensions &&
          ctx.fillRect(
            node.x - bckgDimensions[0] / 2,
            node.y - bckgDimensions[1] / 2,
            ...bckgDimensions
          );
      }}
    />
    </>
  );
}
