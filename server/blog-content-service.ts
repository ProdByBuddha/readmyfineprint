import OpenAI from 'openai';
import { db } from './db.js';
import { 
  blogTopics, 
  blogPosts, 
  contentGeneration, 
  contentSimilarity,
  BlogTopic,
  InsertBlogPost,
  InsertContentGeneration,
  InsertContentSimilarity
} from '@shared/schema';
import { eq, desc, and, gte, isNull, asc } from 'drizzle-orm';

interface ContentOutline {
  introduction: string;
  sections: Array<{
    title: string;
    points: string[];
    wordCount: number;
  }>;
  conclusion: string;
  callToAction: string;
}

interface GeneratedContent {
  title: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  tags: string[];
  readingTime: number;
  wordCount: number;
  structuredData: object;
}

export class BlogContentService {
  private openai: OpenAI;
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for blog content generation');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Get next topic to write about, avoiding recent topics
  async getNextTopic(): Promise<BlogTopic | null> {
    try {
      await db;
      
      // Get unused topics with highest priority
      const unusedTopics = await db
        .select()
        .from(blogTopics)
        .where(eq(blogTopics.isUsed, false))
        .orderBy(desc(blogTopics.priority), asc(blogTopics.createdAt))
        .limit(10);

      if (unusedTopics.length === 0) {
        // If no unused topics, check for topics that haven't been used in 30+ days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const oldTopics = await db
          .select()
          .from(blogTopics)
          .where(
            and(
              eq(blogTopics.isUsed, true),
              gte(blogTopics.usedAt, thirtyDaysAgo)
            )
          )
          .orderBy(desc(blogTopics.priority))
          .limit(5);

        return oldTopics[0] || null;
      }

      // Check similarity with recent posts for each topic
      for (const topic of unusedTopics) {
        const isUnique = await this.checkTopicUniqueness(topic);
        if (isUnique) {
          return topic;
        }
      }

      return unusedTopics[0] || null;
    } catch (error) {
      console.error('Error getting next topic:', error);
      return null;
    }
  }

  // Check if topic is sufficiently different from recent posts
  private async checkTopicUniqueness(topic: BlogTopic): Promise<boolean> {
    try {
      const recentPosts = await db
        .select()
        .from(blogPosts)
        .where(
          gte(blogPosts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
        .limit(10);

      if (recentPosts.length === 0) return true;

      // Simple keyword overlap check
      const topicKeywords = topic.keywords?.toLowerCase().split(',').map(k => k.trim()) || [];
      const topicTitle = topic.title.toLowerCase();

      for (const post of recentPosts) {
        const postKeywords = post.keywords?.toLowerCase().split(',').map((k: string) => k.trim()) || [];
        const postTitle = post.title.toLowerCase();

        // Check title similarity
        const titleWords = topicTitle.split(' ').filter(w => w.length > 3);
        const postTitleWords = postTitle.split(' ').filter((w: string) => w.length > 3);
        const titleOverlap = titleWords.filter(w => postTitleWords.includes(w)).length;
        
        if (titleOverlap > titleWords.length * 0.5) {
          return false; // Too similar
        }

        // Check keyword overlap
        const keywordOverlap = topicKeywords.filter(k => postKeywords.includes(k)).length;
        if (keywordOverlap > Math.min(topicKeywords.length, postKeywords.length) * 0.7) {
          return false; // Too similar
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking topic uniqueness:', error);
      return true; // Default to allowing the topic
    }
  }

  // Generate content outline for a topic
  async generateContentOutline(topic: BlogTopic): Promise<ContentOutline> {
    const prompt = `Create a detailed content outline for a legal blog post about "${topic.title}".

Target Audience: ${topic.targetAudience}
Difficulty Level: ${topic.difficulty}
Category: ${topic.category}
Keywords to include: ${topic.keywords || 'contract law, legal advice'}

The blog should be informative, educational, and help readers understand complex legal concepts in plain English. 

Return a JSON object with this structure:
{
  "introduction": "Brief introduction overview (2-3 sentences)",
  "sections": [
    {
      "title": "Section title",
      "points": ["Key point 1", "Key point 2", "Key point 3"],
      "wordCount": 300
    }
  ],
  "conclusion": "Conclusion overview",
  "callToAction": "Call to action text"
}

Aim for 1500-2500 total words. Make it comprehensive but accessible.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert legal content strategist who creates detailed, SEO-optimized content outlines for legal blogs. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content generated');

      return JSON.parse(content) as ContentOutline;
    } catch (error) {
      console.error('Error generating content outline:', error);
      throw new Error('Failed to generate content outline');
    }
  }

  // Generate full blog post content
  async generateBlogPost(topic: BlogTopic, outline: ContentOutline): Promise<GeneratedContent> {
    const prompt = `Write a comprehensive, SEO-optimized blog post based on this outline:

Title: ${topic.title}
Target Audience: ${topic.targetAudience}
Difficulty: ${topic.difficulty}
Keywords: ${topic.keywords}

Outline:
${JSON.stringify(outline, null, 2)}

Requirements:
1. Write in a professional yet accessible tone
2. Include practical examples and scenarios
3. Use headers (H2, H3) for structure
4. Include actionable advice
5. Make complex legal concepts easy to understand
6. Add disclaimers where appropriate
7. Optimize for SEO with natural keyword integration
8. Write 1500-2500 words
9. Include internal linking opportunities (mention "contract analysis" services)

Return a JSON object with:
{
  "title": "SEO-optimized title (50-60 chars)",
  "excerpt": "Compelling excerpt (150-160 chars)",
  "content": "Full HTML content with proper heading structure",
  "metaTitle": "Meta title (50-60 chars)",
  "metaDescription": "Meta description (150-160 chars)", 
  "keywords": "comma-separated target keywords",
  "tags": ["tag1", "tag2", "tag3"],
  "structuredData": {JSON-LD schema for blog post}
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert legal content writer who creates high-quality, SEO-optimized blog posts about contract law and legal topics. Write engaging, informative content that helps readers understand complex legal concepts. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content generated');

      const generatedData = JSON.parse(content);
      
      // Calculate reading time and word count
      const wordCount = this.countWords(generatedData.content);
      const readingTime = Math.ceil(wordCount / 200); // 200 WPM average

      return {
        ...generatedData,
        readingTime,
        wordCount,
      };
    } catch (error) {
      console.error('Error generating blog post:', error);
      throw new Error('Failed to generate blog post content');
    }
  }

  // Calculate semantic similarity between two pieces of text
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: [text1, text2],
      });

      const [embedding1, embedding2] = response.data.map(item => item.embedding);
      
      // Calculate cosine similarity
      const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
      const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
      const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
      
      return dotProduct / (magnitude1 * magnitude2);
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return 0;
    }
  }

  // Generate and publish a new blog post
  async generateAndPublishPost(): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      await db;

      // Get next topic
      const topic = await this.getNextTopic();
      if (!topic) {
        return { success: false, error: 'No suitable topics available' };
      }

      console.log(`Generating content for topic: ${topic.title}`);

      // Generate outline
      const outline = await this.generateContentOutline(topic);
      
      // Generate full content
      const generatedContent = await this.generateBlogPost(topic, outline);

      // Create slug from title
      const slug = this.createSlug(generatedContent.title);

      // Check if slug already exists
      const existingPost = await db
        .select()
        .from(blogPosts)
        .where(eq(blogPosts.slug, slug))
        .limit(1);

      if (existingPost.length > 0) {
        const uniqueSlug = `${slug}-${Date.now()}`;
        generatedContent.title += ` (${new Date().getFullYear()})`;
      }

      // Save to database
      const [newPost] = await db
        .insert(blogPosts)
        .values({
          slug: existingPost.length > 0 ? `${slug}-${Date.now()}` : slug,
          title: generatedContent.title,
          excerpt: generatedContent.excerpt,
          content: generatedContent.content,
          metaTitle: generatedContent.metaTitle,
          metaDescription: generatedContent.metaDescription,
          keywords: generatedContent.keywords,
          category: topic.category,
          tags: JSON.stringify(generatedContent.tags),
          status: 'published',
          publishedAt: new Date(),
          readingTime: generatedContent.readingTime,
          wordCount: generatedContent.wordCount,
          structuredData: JSON.stringify(generatedContent.structuredData),
        } as InsertBlogPost)
        .returning();

      // Record content generation
      await db.insert(contentGeneration).values({
        topicId: topic.id,
        postId: newPost.id,
        generatedTitle: generatedContent.title,
        generatedOutline: JSON.stringify(outline),
        generatedContent: generatedContent.content,
        aiModel: 'gpt-4o',
        prompt: `Topic: ${topic.title}`,
        qualityScore: '8.5',
        status: 'approved',
      } as InsertContentGeneration);

      // Mark topic as used
      await db
        .update(blogTopics)
        .set({ 
          isUsed: true, 
          usedAt: new Date() 
        })
        .where(eq(blogTopics.id, topic.id));

      // Check similarity with recent posts
      await this.updateSimilarityScores(newPost.id, generatedContent.content);

      console.log(`Successfully generated and published post: ${generatedContent.title}`);
      
      return { success: true, postId: newPost.id };
    } catch (error) {
      console.error('Error generating and publishing post:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Update similarity scores for a new post
  private async updateSimilarityScores(postId: string, content: string) {
    try {
      const recentPosts = await db
        .select()
        .from(blogPosts)
        .where(
          and(
            gte(blogPosts.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
            // ne(blogPosts.id, postId) // Exclude the current post
          )
        )
        .limit(20);

      for (const post of recentPosts) {
        if (post.id === postId) continue;
        
        const similarity = await this.calculateSimilarity(content, post.content);
        
        if (similarity > 0.1) { // Only store meaningful similarities
          await db.insert(contentSimilarity).values({
            postId1: postId,
            postId2: post.id,
            similarityScore: similarity.toString(),
            comparisonMethod: 'semantic',
          } as InsertContentSimilarity);
        }
      }
    } catch (error) {
      console.error('Error updating similarity scores:', error);
    }
  }

  // Utility functions
  private createSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  private countWords(html: string): number {
    // Remove HTML tags and count words
    const text = html.replace(/<[^>]*>/g, ' ');
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Seed initial topics
  async seedTopics() {
    try {
      await db;
      
      const topics = [
        {
          title: "Understanding Non-Disclosure Agreements: A Complete Guide",
          description: "Comprehensive guide to NDAs, when to use them, and how to negotiate terms",
          category: "contract-law",
          difficulty: "beginner",
          keywords: "non-disclosure agreement, NDA, confidentiality, contract law",
          targetAudience: "business-owners",
          priority: 10,
        },
        {
          title: "Employment Contract Red Flags Every Worker Should Know",
          description: "Key warning signs in employment contracts that could harm your rights",
          category: "employment-law",
          difficulty: "beginner", 
          keywords: "employment contract, worker rights, contract negotiation",
          targetAudience: "general",
          priority: 9,
        },
        {
          title: "How to Negotiate Better Terms in Service Agreements",
          description: "Practical strategies for negotiating favorable terms in service contracts",
          category: "contract-negotiation",
          difficulty: "intermediate",
          keywords: "contract negotiation, service agreement, business contracts",
          targetAudience: "business-owners",
          priority: 8,
        },
        {
          title: "Understanding Force Majeure Clauses After COVID-19",
          description: "How pandemic-era changes affect force majeure provisions in contracts",
          category: "contract-law",
          difficulty: "intermediate",
          keywords: "force majeure, pandemic contracts, business continuity",
          targetAudience: "business-owners",
          priority: 7,
        },
        {
          title: "The Complete Guide to Software License Agreements",
          description: "Understanding SaaS, perpetual, and subscription software licensing terms",
          category: "intellectual-property",
          difficulty: "intermediate",
          keywords: "software license, SaaS agreements, intellectual property",
          targetAudience: "business-owners",
          priority: 8,
        }
      ];

      for (const topic of topics) {
        try {
          await db.insert(blogTopics).values(topic);
        } catch (error) {
          // Topic might already exist, continue
          console.log(`Topic "${topic.title}" may already exist`);
        }
      }

      console.log('Topics seeded successfully');
    } catch (error) {
      console.error('Error seeding topics:', error);
    }
  }
}

export const blogContentService = new BlogContentService();