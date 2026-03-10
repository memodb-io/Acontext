package api

import "context"

// --- Admin Project operations (/admin/v1/project) ---

func (c *Client) AdminCreateProject(ctx context.Context, req *CreateProjectRequest) (*ProjectInfo, error) {
	var project ProjectInfo
	if err := c.Post(ctx, "/admin/v1/project", req, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

func (c *Client) AdminDeleteProject(ctx context.Context, projectID string) error {
	return c.Delete(ctx, "/admin/v1/project/"+projectID, nil)
}

func (c *Client) AdminRotateKey(ctx context.Context, projectID string) (*ProjectInfo, error) {
	var project ProjectInfo
	if err := c.Put(ctx, "/admin/v1/project/"+projectID+"/secret_key", nil, &project); err != nil {
		return nil, err
	}
	return &project, nil
}

func (c *Client) AdminGetProjectStats(ctx context.Context, projectID string) (*ProjectStats, error) {
	var stats ProjectStats
	if err := c.Get(ctx, "/admin/v1/project/"+projectID+"/statistics", &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

func (c *Client) AdminGetProjectUsages(ctx context.Context, projectID string) (interface{}, error) {
	var usages interface{}
	if err := c.Get(ctx, "/admin/v1/project/"+projectID+"/usages", &usages); err != nil {
		return nil, err
	}
	return usages, nil
}
