package api

import "context"

// --- Admin Project operations (/admin/v1/project) ---

func (c *Client) AdminCreateProject(ctx context.Context, req *CreateProjectRequest) (*CreateProjectResponse, error) {
	var resp CreateProjectResponse
	if err := c.Post(ctx, "/admin/v1/project", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) AdminDeleteProject(ctx context.Context, projectID string) error {
	return c.Delete(ctx, "/admin/v1/project/"+projectID, nil)
}

func (c *Client) AdminRotateKey(ctx context.Context, projectID string) (*RotateKeyResponse, error) {
	var resp RotateKeyResponse
	if err := c.Put(ctx, "/admin/v1/project/"+projectID+"/secret_key", nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
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
